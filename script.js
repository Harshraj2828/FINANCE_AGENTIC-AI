// Client side logic for FinAI Agentic Suite

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const agentCards = document.querySelectorAll('.agent-card');
    const messagesContainer = document.getElementById('messages-container');
    const welcomeContainer = document.getElementById('welcome-container');
    const suggestionsGrid = document.getElementById('suggestions-grid');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const btnSend = document.getElementById('btn-send');
    const btnClearChat = document.getElementById('btn-clear-chat');
    
    const headerIconContainer = document.getElementById('header-icon-container');
    const headerIcon = document.getElementById('header-icon');
    const headerAgentName = document.getElementById('header-agent-name');
    const headerAgentStatus = document.getElementById('header-agent-status');

    // State Variables
    let currentAgent = 'finance'; // default
    let chatHistory = {
        finance: [],
        web_search: [],
        team: []
    };
    
    // Active session IDs for each agent
    let activeSessionIds = {
        finance: null,
        web_search: null,
        team: null
    };

    // Load from localStorage on startup and migrate format if needed
    const savedHistory = localStorage.getItem('finai_chat_history');
    if (savedHistory) {
        try {
            const parsed = JSON.parse(savedHistory);
            ['finance', 'web_search', 'team'].forEach(agent => {
                if (Array.isArray(parsed[agent])) {
                    if (parsed[agent].length > 0 && parsed[agent][0].role) {
                        // Migrate flat message list to session-structured list
                        const migratedSession = {
                            id: 'migrated-' + Math.random().toString(36).substring(7),
                            timestamp: 'Earlier',
                            messages: parsed[agent]
                        };
                        chatHistory[agent] = [migratedSession];
                    } else {
                        chatHistory[agent] = parsed[agent];
                    }
                }
            });
        } catch (e) {
            console.error('Failed to parse chat history', e);
        }
    }

    // Initialize session IDs
    ['finance', 'web_search', 'team'].forEach(agent => {
        const sessions = chatHistory[agent];
        if (sessions.length === 0) {
            const initialSession = {
                id: 'init-' + Math.random().toString(36).substring(7),
                timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                messages: []
            };
            sessions.push(initialSession);
        }
        activeSessionIds[agent] = sessions[sessions.length - 1].id;
    });

    // Suggestions configuration based on agent
    const suggestions = {
        finance: [
            { text: "What is Apple (AAPL) stock price & fundamentals?", tag: "yFinance Fundamentals" },
            { text: "Summarize analyst recommendations for NVDA", tag: "Analyst Ratings" },
            { text: "Compare Tesla (TSLA) and Microsoft (MSFT) stock", tag: "Comparison" },
            { text: "Show latest company news for Amazon (AMZN)", tag: "Company News" }
        ],
        web_search: [
            { text: "Search the web for latest space exploration achievements", tag: "DuckDuckGo Search" },
            { text: "What is the latest news about Groq AI models?", tag: "Latest Tech News" },
            { text: "Summarize current news on electric vehicle market trends", tag: "EV Trends" },
            { text: "Find news about major macroeconomic updates this week", tag: "Macro Economy" }
        ],
        team: [
            { text: "Analyze Nvidia (NVDA) stock price and list latest news", tag: "Multi-Agent Research" },
            { text: "Compare AMD and Intel: financials, fundamentals, and recent news", tag: "Comparison Team" },
            { text: "Research Tesla's latest self-driving news and analyst ratings", tag: "Collaborative Report" },
            { text: "Get price, fundamentals, and analyst ratings for Microsoft", tag: "Full Audit" }
        ]
    };

    // Agent specific styling data
    const agentThemes = {
        finance: {
            name: "Finance Agent",
            status: "Ready for market intelligence questions",
            icon: "trending-up",
            colorClass: "finance-theme",
            activeColor: "#06b6d4",
            activeBg: "rgba(6, 182, 212, 0.1)",
            activeBorder: "rgba(6, 182, 212, 0.2)"
        },
        web_search: {
            name: "Web Search Agent",
            status: "Search the web for up-to-date sources",
            icon: "globe",
            colorClass: "web-search-theme",
            activeColor: "#10b981",
            activeBg: "rgba(16, 185, 129, 0.1)",
            activeBorder: "rgba(16, 185, 129, 0.2)"
        },
        team: {
            name: "Multi-Agent Team",
            status: "Finance & Search agents working in team collaboration",
            icon: "users",
            colorClass: "team-theme",
            activeColor: "#8b5cf6",
            activeBg: "rgba(139, 92, 246, 0.1)",
            activeBorder: "rgba(139, 92, 246, 0.2)"
        }
    };

    // Initialize marked.js options
    marked.setOptions({
        breaks: true,
        gfm: true
    });

    // Initialize app
    updateAgentTheme(currentAgent);
    loadSuggestions(currentAgent);
    renderChatHistory(); // Render loaded history
    userInput.focus();
    lucide.createIcons();

    // Event Listeners
    agentCards.forEach(card => {
        card.addEventListener('click', () => {
            const agentId = card.getAttribute('data-agent-id');
            if (agentId === currentAgent) return;
            
            // Set active card UI
            agentCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            currentAgent = agentId;
            updateAgentTheme(currentAgent);
            loadSuggestions(currentAgent);
            renderChatHistory();
        });
    });

    userInput.addEventListener('input', () => {
        adjustTextareaHeight();
        btnSend.disabled = userInput.value.trim() === '';
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (userInput.value.trim() !== '') {
                chatForm.requestSubmit();
            }
        }
    });

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;
        
        sendMessage(text);
    });

    btnClearChat.addEventListener('click', () => {
        const sessions = chatHistory[currentAgent];
        const activeSession = getActiveSession();
        
        // Start a new session only if current session is not empty
        if (activeSession && activeSession.messages.length > 0) {
            const newSession = {
                id: 'session-' + Math.random().toString(36).substring(7),
                timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                messages: []
            };
            sessions.push(newSession);
            activeSessionIds[currentAgent] = newSession.id;
            localStorage.setItem('finai_chat_history', JSON.stringify(chatHistory));
        }
        renderChatHistory();
    });

    // Helper functions
    function adjustTextareaHeight() {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight - 16) + 'px';
    }

    function updateAgentTheme(agentId) {
        const theme = agentThemes[agentId];
        
        // Update CSS custom properties
        document.documentElement.style.setProperty('--theme-active', theme.activeColor);
        document.documentElement.style.setProperty('--theme-active-bg', theme.activeBg);
        document.documentElement.style.setProperty('--theme-active-border', theme.activeBorder);
        
        // Update header
        headerIconContainer.className = `header-agent-icon ${theme.colorClass}`;
        headerIcon.setAttribute('data-lucide', theme.icon);
        headerAgentName.textContent = theme.name;
        headerAgentStatus.textContent = theme.status;
        
        // Update logo icon color
        document.querySelector('.logo-icon').setAttribute('data-lucide', theme.icon);
        
        // Re-create dynamic header/sidebar icons
        lucide.createIcons();
    }

    function loadSuggestions(agentId) {
        suggestionsGrid.innerHTML = '';
        const list = suggestions[agentId];
        list.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.innerHTML = `${item.text} <span>${item.tag} <i data-lucide="arrow-right" style="width:12px;height:12px"></i></span>`;
            btn.addEventListener('click', () => {
                userInput.value = item.text;
                userInput.focus();
                adjustTextareaHeight();
                btnSend.disabled = false;
            });
            suggestionsGrid.appendChild(btn);
        });
        lucide.createIcons();
    }

    function scrollChatToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function createMessageBubble(role, content = '', tools = []) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = `message-avatar ${role === 'user' ? 'user-avatar' : 'assistant-avatar'}`;
        
        const iconName = role === 'user' ? 'user' : agentThemes[currentAgent].icon;
        avatar.innerHTML = `<i data-lucide="${iconName}"></i>`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        // Tool runs container inside bubble
        const toolContainer = document.createElement('div');
        toolContainer.className = 'tool-runs-container';
        bubble.appendChild(toolContainer);
        
        // Content container inside bubble
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        if (role === 'user') {
            contentDiv.textContent = content;
        } else {
            contentDiv.innerHTML = content ? marked.parse(content) : '';
        }
        bubble.appendChild(contentDiv);
        
        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);
        messagesContainer.appendChild(wrapper);
        
        lucide.createIcons();
        scrollChatToBottom();
        
        return { wrapper, contentDiv, toolContainer };
    }

    function renderChatHistory() {
        // Clear all except welcome container
        const currentMessages = messagesContainer.querySelectorAll('.message-wrapper');
        currentMessages.forEach(m => m.remove());
        
        const sessions = chatHistory[currentAgent];
        const activeSessionId = activeSessionIds[currentAgent];
        const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[sessions.length - 1];
        
        const messages = activeSession ? activeSession.messages : [];
        
        if (messages.length === 0) {
            welcomeContainer.style.display = 'flex';
        } else {
            welcomeContainer.style.display = 'none';
            messages.forEach(msg => {
                createMessageBubble(msg.role, msg.content);
            });
        }
        scrollChatToBottom();
    }

    function renderToolCall(container, tool) {
        const toolId = tool.id || tool.tool_call_id || Math.random().toString(36).substring(7);
        const argStr = JSON.stringify(tool.args || tool.tool_args || {});
        
        const badge = document.createElement('div');
        badge.className = 'tool-run-badge';
        badge.setAttribute('data-target-id', `details-${toolId}`);
        badge.innerHTML = `
            <div class="tool-run-left">
                ${tool.running ? '<div class="tool-run-spinner"></div>' : '<div class="tool-run-success-icon"><i data-lucide="check-circle-2"></i></div>'}
                <span>Used tool: <span class="tool-run-name">${tool.name || tool.tool_name}</span></span>
            </div>
            <i data-lucide="chevron-down" class="tool-run-toggle"></i>
        `;
        
        const details = document.createElement('div');
        details.className = 'tool-run-details';
        details.id = `details-${toolId}`;
        details.style.display = 'none';
        
        const inputArgs = tool.args || tool.tool_args || {};
        const outputRes = tool.result || tool.content || '';
        details.textContent = `Input arguments:\n${JSON.stringify(inputArgs, null, 2)}\n\nOutput result:\n${typeof outputRes === 'object' ? JSON.stringify(outputRes, null, 2) : outputRes}`;
        
        // Toggle details display on badge click
        badge.addEventListener('click', () => {
            const isVisible = details.style.display === 'block';
            details.style.display = isVisible ? 'none' : 'block';
            badge.querySelector('.tool-run-toggle').style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        });
        
        container.appendChild(badge);
        container.appendChild(details);
        lucide.createIcons();
    }

    function getActiveSession() {
        const sessions = chatHistory[currentAgent];
        const activeSessionId = activeSessionIds[currentAgent];
        let activeSession = sessions.find(s => s.id === activeSessionId);
        if (!activeSession) {
            activeSession = sessions[sessions.length - 1];
            activeSessionIds[currentAgent] = activeSession.id;
        }
        return activeSession;
    }

    async function sendMessage(text) {
        const activeSession = getActiveSession();
        const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        activeSession.timestamp = timestamp;
        
        // Save user message to history
        activeSession.messages.push({ role: 'user', content: text, timestamp });
        localStorage.setItem('finai_chat_history', JSON.stringify(chatHistory));
        
        // Add User message to UI
        welcomeContainer.style.display = 'none';
        createMessageBubble('user', text);
        
        // Reset and disable input
        userInput.value = '';
        btnSend.disabled = true;
        userInput.disabled = true;
        adjustTextareaHeight();
        
        // Create typing indicator / assistant bubble template
        const { contentDiv, toolContainer } = createMessageBubble('assistant');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        contentDiv.appendChild(typingDiv);
        scrollChatToBottom();
        
        let assistantContent = '';
        let toolsExecuted = [];
        let toolInstancesMap = new Map(); // tracks tool badges elements

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: text,
                    agent: currentAgent
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned HTTP status ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            // Remove typing indicator as stream starts
            typingDiv.remove();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // save last partial line
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmedLine.substring(6));
                            
                            if (data.type === 'tool') {
                                // Add tool execution to history array
                                const toolKey = data.name + JSON.stringify(data.args);
                                if (!toolInstancesMap.has(toolKey)) {
                                    const toolObj = {
                                        name: data.name,
                                        args: data.args,
                                        result: data.result,
                                        running: false
                                    };
                                    toolsExecuted.push(toolObj);
                                    toolInstancesMap.set(toolKey, true);
                                }
                            } else if (data.type === 'token') {
                                assistantContent += data.content;
                                contentDiv.innerHTML = marked.parse(assistantContent);
                                scrollChatToBottom();
                            } else if (data.type === 'done') {
                                break;
                            }
                        } catch (e) {
                            console.error('Failed to parse line JSON:', trimmedLine, e);
                        }
                    }
                }
            }
            
            // Finalize and save assistant message to history
            const activeSession = getActiveSession();
            const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            activeSession.messages.push({
                role: 'assistant',
                content: assistantContent,
                tools: toolsExecuted,
                timestamp
            });
            localStorage.setItem('finai_chat_history', JSON.stringify(chatHistory));

        } catch (error) {
            console.error('Streaming error:', error);
            typingDiv.remove();
            
            const errorText = document.createElement('div');
            errorText.style.color = '#ef4444';
            errorText.style.fontWeight = '500';
            errorText.innerHTML = `<i data-lucide="alert-circle" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:6px"></i> Connection error. Make sure Groq API keys are set.`;
            contentDiv.appendChild(errorText);
            lucide.createIcons();
            
            const activeSession = getActiveSession();
            const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            activeSession.messages.push({
                role: 'assistant',
                content: "Connection error occurred. Please verify your environment configurations.",
                tools: [],
                timestamp
            });
            localStorage.setItem('finai_chat_history', JSON.stringify(chatHistory));
        } finally {
            // Enable inputs
            userInput.disabled = false;
            userInput.focus();
            btnSend.disabled = userInput.value.trim() === '';
        }
    }

    // History Modal Functionality
    const btnHistory = document.getElementById('btn-history');
    const historyModal = document.getElementById('history-modal');
    const btnCloseHistory = document.getElementById('btn-close-history');
    const modalTabs = document.querySelectorAll('.modal-tab');
    const historyItemsList = document.getElementById('history-items-list');
    let activeHistoryTab = 'finance';

    btnHistory.addEventListener('click', () => {
        historyModal.classList.add('active');
        loadHistoryTabItems(activeHistoryTab);
    });

    btnCloseHistory.addEventListener('click', () => {
        historyModal.classList.remove('active');
    });

    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) {
            historyModal.classList.remove('active');
        }
    });

    modalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modalTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeHistoryTab = tab.getAttribute('data-tab');
            loadHistoryTabItems(activeHistoryTab);
        });
    });

    function loadHistoryTabItems(agentId) {
        historyItemsList.innerHTML = '';
        const sessions = chatHistory[agentId] || [];
        
        // Filter out empty sessions in history view
        const nonEmptySessions = sessions.filter(s => s.messages && s.messages.length > 0);
        
        if (nonEmptySessions.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'history-empty';
            empty.innerHTML = `
                <i data-lucide="archive"></i>
                <p>No chat history available for this agent yet.</p>
            `;
            historyItemsList.appendChild(empty);
            lucide.createIcons();
            return;
        }
        
        // Render sessions in reverse chronological order
        [...nonEmptySessions].reverse().forEach(session => {
            const firstUserMsg = session.messages.find(m => m.role === 'user');
            const firstAssistantMsg = session.messages.find(m => m.role === 'assistant');
            
            const promptText = firstUserMsg ? firstUserMsg.content : 'Empty Chat';
            const responseSnippet = firstAssistantMsg ? firstAssistantMsg.content : 'No reply...';
            
            const item = document.createElement('div');
            item.className = 'history-item-row';
            
            // Highlight item if it is the current active session
            const isActive = activeSessionIds[agentId] === session.id;
            if (isActive && currentAgent === agentId) {
                item.style.borderColor = 'var(--theme-active)';
                item.style.background = 'var(--theme-active-bg)';
            }
            
            item.innerHTML = `
                <div class="history-item-header">
                    <div class="history-item-title">${promptText}</div>
                    <div class="history-item-time">${session.timestamp}</div>
                </div>
                <div class="history-item-snippet">${responseSnippet}</div>
            `;
            
            item.addEventListener('click', () => {
                historyModal.classList.remove('active');
                
                // 1. Switch active agent if needed
                if (currentAgent !== agentId) {
                    currentAgent = agentId;
                    agentCards.forEach(c => {
                        c.classList.remove('active');
                        if (c.getAttribute('data-agent-id') === agentId) {
                            c.classList.add('active');
                        }
                    });
                    updateAgentTheme(agentId);
                    loadSuggestions(agentId);
                }
                
                // 2. Set this session as active
                activeSessionIds[agentId] = session.id;
                
                // 3. Re-render chat history
                renderChatHistory();
            });
            
            historyItemsList.appendChild(item);
        });
        lucide.createIcons();
    }
});
