import os
import json
import pathlib
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

from phi.agent import Agent
from phi.model.groq import Groq
from phi.tools.yfinance import YFinanceTools
from phi.tools.duckduckgo import DuckDuckGo

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="FinAI Agentic Suite")

# Directory containing the static files
BASE_DIR = pathlib.Path(__file__).parent.resolve()

# 1. Define web search agent
web_search_agent = Agent(
    name="Web Search Agent",
    role="Search the web for the information",
    model=Groq(id="llama-3.3-70b-versatile"),
    tools=[DuckDuckGo()],
    instructions=["Always include sources"],
    show_tool_calls=False,
    markdown=True,
)

# 2. Define financial agent
finance_agent = Agent(
    name="Finance AI Agent",
    model=Groq(id="llama-3.3-70b-versatile"),
    tools=[
        YFinanceTools(
            stock_price=True,
            analyst_recommendations=True,
            stock_fundamentals=True,
            company_news=True,
        )
    ],
    instructions=["Use tables to display the data"],
    show_tool_calls=False,
    markdown=True,
)

# 3. Define team agent (collaborative)
multi_ai_agent = Agent(
    name="Multi-Agent Team",
    team=[web_search_agent, finance_agent],
    model=Groq(id="llama-3.3-70b-versatile"),
    instructions=[
        "Always include sources",
        "Use tables to display data",
    ],
    show_tool_calls=False,
    markdown=True,
)


class ChatRequest(BaseModel):
    prompt: str
    agent: str


# Serve frontend index.html
@app.get("/", response_class=HTMLResponse)
def read_root():
    try:
        html_path = BASE_DIR / "index.html"
        return HTMLResponse(content=html_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading index.html: {str(e)}")


# Serve style.css
@app.get("/style.css")
def read_style():
    try:
        css_path = BASE_DIR / "style.css"
        return Response(content=css_path.read_text(encoding="utf-8"), media_type="text/css")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading style.css: {str(e)}")


# Serve script.js
@app.get("/script.js")
def read_script():
    try:
        js_path = BASE_DIR / "script.js"
        return Response(content=js_path.read_text(encoding="utf-8"), media_type="application/javascript")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading script.js: {str(e)}")


# Stream chat endpoint
@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    if request.agent == "finance":
        selected_agent = finance_agent
    elif request.agent == "web_search":
        selected_agent = web_search_agent
    elif request.agent == "team":
        selected_agent = multi_ai_agent
    else:
        raise HTTPException(status_code=400, detail="Invalid agent selected")

    def event_generator():
        sent_tool_ids = set()
        try:
            # Yield chunks from agent run stream
            for resp in selected_agent.run(request.prompt, stream=True):
                # Stream tool execution details if available
                if resp.tools:
                    for tool in resp.tools:
                        tool_id = tool.get("tool_call_id") or tool.get("id") or f"{tool.get('tool_name')}-{json.dumps(tool.get('tool_args'))}"
                        if tool_id not in sent_tool_ids:
                            sent_tool_ids.add(tool_id)
                            tool_data = {
                                "type": "tool",
                                "name": tool.get("tool_name"),
                                "args": tool.get("tool_args"),
                                "result": tool.get("content")
                            }
                            yield f"data: {json.dumps(tool_data)}\n\n"

                # Stream incremental text tokens
                if resp.content:
                    token_data = {
                        "type": "token",
                        "content": resp.content
                    }
                    yield f"data: {json.dumps(token_data)}\n\n"

            # Finish stream signal
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            # Stream error detail to client
            error_data = {
                "type": "error",
                "content": str(e)
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("playground:app", host="127.0.0.1", port=8000, reload=True)