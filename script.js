// Windows 3.1 Program Manager

class ProgramManager {
    constructor() {
        this.zIndex = 100;
        this.currentWindow = null;
        this.minimizedWindows = new Map();
        this.init();
    }

    init() {
        this.setupGroupIcons();
        this.setupProgramIcons();
        this.setupSystemMenu();
        this.setupClickOutside();
        this.setupProgramManagerControls();
        this.setupDesktopIcons();
        this.setupStatusBarControls();
        this.setupDesktopClickDeselect();
        this.updateStatusBar();
        setInterval(() => this.updateStatusBar(), 1000);
    }

    setupDesktopClickDeselect() {
        // Deselect icons when clicking on windows, taskbar, status bar, or empty desktop
        document.addEventListener('click', (e) => {
            // Don't deselect if clicking on an icon itself or its menu
            if (e.target.closest('.desktop-icon') || 
                e.target.closest('.minimized-program-manager') ||
                e.target.closest('#desktop-icon-menu') ||
                e.target.closest('.taskbar-item') ||
                e.target.closest('#taskbar-item-menu')) {
                return;
            }
            
            // Hide context menus if clicking elsewhere
            this.hideDesktopIconMenu();
            this.hideTaskbarItemMenu();
            
            // Deselect taskbar items
            document.querySelectorAll('.taskbar-item').forEach(item => item.classList.remove('selected'));
            
            // Deselect when clicking on windows, taskbar, status bar, or desktop
            if (e.target.closest('.window') || 
                e.target.closest('.desktop-taskbar') || 
                e.target.closest('.desktop-status-bar') ||
                e.target.closest('.program-manager') ||
                e.target.classList.contains('win31-desktop') ||
                e.target.classList.contains('screen-content')) {
                document.querySelectorAll('.desktop-icon, .minimized-program-manager').forEach(i => i.classList.remove('selected'));
            }
        });
    }

    setupStatusBarControls() {
        // Volume control
        const volumeControl = document.getElementById('volume-control');
        const volumeValue = document.getElementById('volume-value');
        let volume = 100;
        let isMuted = false;

        // Create volume dropdown
        const volumeDropdown = document.createElement('div');
        volumeDropdown.className = 'volume-dropdown';
        volumeDropdown.id = 'volume-dropdown';
        volumeDropdown.innerHTML = `
            <div class="volume-slider-container">
                <div class="volume-slider-label">Volume: <span id="volume-display">100%</span></div>
                <input type="range" class="volume-slider" id="volume-slider" min="0" max="100" value="100" />
                <button class="volume-mute-btn" id="volume-mute-btn">Mute</button>
            </div>
        `;
        document.querySelector('.screen-content').appendChild(volumeDropdown);

        const volumeSlider = document.getElementById('volume-slider');
        const volumeDisplay = document.getElementById('volume-display');
        const muteBtn = document.getElementById('volume-mute-btn');

        volumeControl.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('volume-dropdown');
            const rect = volumeControl.getBoundingClientRect();
            const screenContent = document.querySelector('.screen-content');
            const screenRect = screenContent.getBoundingClientRect();
            
            if (dropdown.style.display === 'block') {
                dropdown.style.display = 'none';
            } else {
                dropdown.style.left = (rect.left - screenRect.left) + 'px';
                dropdown.style.bottom = (screenRect.bottom - rect.top + 4) + 'px';
                dropdown.style.display = 'block';
            }
        });

        volumeSlider.addEventListener('input', (e) => {
            volume = parseInt(e.target.value);
            if (!isMuted) {
                volumeValue.textContent = volume + '%';
                volumeDisplay.textContent = volume + '%';
                volumeControl.querySelector('.status-icon').textContent = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
            }
        });

        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) {
                volumeValue.textContent = 'Muted';
                volumeDisplay.textContent = 'Muted';
                volumeControl.querySelector('.status-icon').textContent = '🔇';
                muteBtn.textContent = 'Unmute';
            } else {
                volumeValue.textContent = volume + '%';
                volumeDisplay.textContent = volume + '%';
                volumeControl.querySelector('.status-icon').textContent = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
                muteBtn.textContent = 'Mute';
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!volumeControl.contains(e.target) && !volumeDropdown.contains(e.target)) {
                volumeDropdown.style.display = 'none';
            }
        });
    }

    setupDesktopIcons() {
        const aiIcon = document.getElementById('ai-assistant-icon');
        if (aiIcon) {
            // Single click to select and show context menu
            aiIcon.addEventListener('click', (e) => {
                // Don't show menu if in move mode (clicking to place)
                if (aiIcon.dataset.moveMode) {
                    return;
                }
                
                // Only select if we didn't just drag
                if (window.aiIconDragging === true) {
                    window.aiIconDragging = false;
                    return;
                }
                
                // Deselect all desktop icons and minimized program manager
                document.querySelectorAll('.desktop-icon, .minimized-program-manager').forEach(i => i.classList.remove('selected'));
                aiIcon.classList.add('selected');
                
                // Show context menu
                this.showDesktopIconMenu(aiIcon, 'ai-assistant');
                e.stopPropagation();
            });
            
            // Double click to open
            aiIcon.addEventListener('dblclick', () => {
                this.hideDesktopIconMenu();
                this.openAIAssistant();
            });
            
            // Don't setup drag by default - only when Move is selected
        }
        
        // Don't setup drag for minimized Program Manager by default
    }

    setupIconDrag(icon) {
        // Only allow drag if move mode is enabled
        if (!icon.dataset.moveMode) {
            return;
        }
        
        // Make icon follow cursor automatically
        const mousemoveHandler = (e) => {
            if (!icon.dataset.moveMode) {
                document.removeEventListener('mousemove', mousemoveHandler);
                return;
            }
            
            const screenContent = document.querySelector('.screen-content');
            const screenRect = screenContent.getBoundingClientRect();
            
            // Calculate new position - center icon on cursor
            let newLeft = e.clientX - screenRect.left - (icon.offsetWidth / 2);
            let newTop = e.clientY - screenRect.top - (icon.offsetHeight / 2);
            
            // Constrain to screen bounds
            const maxX = screenContent.offsetWidth - icon.offsetWidth;
            const maxY = screenContent.offsetHeight - icon.offsetHeight - 24; // Account for status bar
            
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            icon.style.left = newLeft + 'px';
            icon.style.top = newTop + 'px';
            icon.style.position = 'absolute';
        };
        
        document.addEventListener('mousemove', mousemoveHandler);
        
        // Click to place (exit move mode) - prevent menu from showing
        const clickHandler = (e) => {
            if (icon.dataset.moveMode) {
                e.stopPropagation();
                e.preventDefault();
                delete icon.dataset.moveMode;
                icon.style.cursor = '';
                icon.classList.remove('selected');
                document.body.classList.remove('move-mode-active');
                document.removeEventListener('mousemove', mousemoveHandler);
                document.removeEventListener('click', clickHandler, true);
                // Clear dragging flag
                if (icon.id === 'ai-assistant-icon') {
                    window.aiIconDragging = false;
                } else if (icon.id === 'program-manager-minimized') {
                    window.pmIconDragging = false;
                }
            }
        };
        
        // Use capture phase to intercept click before it reaches icon handlers
        document.addEventListener('click', clickHandler, true);
    }

    setupMinimizedProgramManagerDrag() {
        // This will be called when Program Manager is minimized
        // We'll set it up in minimizeProgramManager
    }

    openAIAssistant() {
        const aiApp = document.getElementById('ai-assistant-app');
        if (!aiApp) return;

        if (aiApp.style.display === 'none' || !aiApp.style.display) {
            aiApp.style.display = 'flex';
            
            // Position flush with bottom-right corner, above status bar
            const screenContent = document.querySelector('.screen-content');
            const statusBar = document.querySelector('.desktop-status-bar');
            const offset = 8; // Small padding from edges
            const windowWidth = 500;
            const windowHeight = 400;
            
            // Calculate position so bottom-right corner is flush with viewport, above status bar
            const screenRect = screenContent.getBoundingClientRect();
            const statusBarHeight = statusBar ? statusBar.offsetHeight : 0;
            const left = screenRect.width - windowWidth - offset;
            const top = screenRect.height - windowHeight - statusBarHeight - offset;
            
            aiApp.style.left = `${left}px`;
            aiApp.style.top = `${top}px`;
            aiApp.style.width = `${windowWidth}px`;
            aiApp.style.height = `${windowHeight}px`;
            
            this.setupWindowDrag(aiApp);
            this.setupSingleWindowControls(aiApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('ai-assistant-app');
            
            // Setup AI assistant functionality
            this.setupAIAssistant();
        }
        
        this.focusWindow(aiApp);
    }

    setupAIAssistant() {
        const aiApp = document.getElementById('ai-assistant-app');
        if (aiApp.dataset.setup) return;
        aiApp.dataset.setup = 'true';

        const input = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send-btn');
        const chatArea = document.getElementById('ai-chat-area');

        const sendMessage = () => {
            const query = input.value.trim();
            if (!query) return;

            // Add user message
            const userMsg = document.createElement('div');
            userMsg.className = 'ai-message ai-user';
            userMsg.innerHTML = `<div class="message-text">${query}</div>`;
            chatArea.appendChild(userMsg);

            // Clear input
            input.value = '';

            // Scroll to bottom
            chatArea.scrollTop = chatArea.scrollHeight;

            // Simulate AI response (retro style)
            setTimeout(() => {
                const aiMsg = document.createElement('div');
                aiMsg.className = 'ai-message ai-assistant';
                const responses = [
                    "That's an interesting question! In the retro computing era, we would have consulted manuals and documentation.",
                    "Processing your request... Please wait while I search through my knowledge base.",
                    "I'm a retro AI assistant from the Windows 3.1 era. My capabilities are limited compared to modern AI, but I'll do my best!",
                    "Let me check my database... Hmm, that's a complex query. Would you like me to search for more information?",
                    "In the classic computing days, we relied on command-line interfaces and text-based systems. Your question reminds me of those times!",
                    "I'm processing your request using vintage algorithms. This might take a moment...",
                    "That's a great question! Unfortunately, as a retro AI, I don't have access to real-time web search, but I can help with general knowledge.",
                ];
                const response = responses[Math.floor(Math.random() * responses.length)];
                aiMsg.innerHTML = `<div class="message-text">${response}</div>`;
                chatArea.appendChild(aiMsg);
                chatArea.scrollTop = chatArea.scrollHeight;
            }, 500);
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    updateStatusBar() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
        
        const timeElement = document.getElementById('status-time');
        if (timeElement) {
            timeElement.textContent = `${displayHours}:${minutes} ${ampm}`;
        }
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dayName = days[now.getDay()];
        const monthName = months[now.getMonth()];
        const date = now.getDate();
        const year = now.getFullYear();
        
        const dateElement = document.getElementById('status-date');
        if (dateElement) {
            dateElement.textContent = `${dayName}, ${monthName} ${date}, ${year}`;
        }
    }

    setupProgramManagerControls() {
        const programManager = document.querySelector('.program-manager');
        if (!programManager) return;

        const systemMenuBtn = programManager.querySelector('.system-menu');
        const buttons = programManager.querySelectorAll('.window-btn');
        const minimizeBtn = buttons[0];
        const maximizeBtn = buttons[1];

        // System menu button - show dropdown
        if (systemMenuBtn) {
            systemMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('system-menu-dropdown');
                if (dropdown.style.display === 'block' && this.currentWindow === programManager) {
                    this.hideSystemMenu();
                } else {
                    this.showSystemMenu(programManager, systemMenuBtn);
                }
            });
        }

        // Minimize button - minimize to icon
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.minimizeProgramManager();
            });
        }

        // Maximize button
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Program Manager is already maximized by default
            });
        }
    }

    minimizeProgramManager() {
        const programManager = document.querySelector('.program-manager');
        programManager.style.display = 'none';
        
        // Deselect any currently selected group icons
        document.querySelectorAll('.group-icon').forEach(i => i.classList.remove('selected'));
        
        // Show minimized icon at top left of desktop
        let minimizedIcon = document.getElementById('program-manager-minimized');
        if (!minimizedIcon) {
            minimizedIcon = document.createElement('div');
            minimizedIcon.id = 'program-manager-minimized';
            minimizedIcon.className = 'minimized-program-manager group-icon';
            minimizedIcon.innerHTML = `
                <div class="minimized-icon-image group-icon-image">
                    <div class="mini-window-icon"></div>
                </div>
                <div class="minimized-icon-label group-icon-label">Program Manager</div>
            `;
            // Single click to select and show context menu
            minimizedIcon.addEventListener('click', (e) => {
                // Don't show menu if in move mode (clicking to place)
                if (minimizedIcon.dataset.moveMode) {
                    return;
                }
                
                // Only select if we didn't just drag
                if (window.pmIconDragging === true) {
                    window.pmIconDragging = false;
                    return;
                }
                
                // Deselect all desktop icons and group icons
                document.querySelectorAll('.desktop-icon, .group-icon').forEach(i => i.classList.remove('selected'));
                minimizedIcon.classList.add('selected');
                
                // Show context menu
                this.showDesktopIconMenu(minimizedIcon, 'program-manager');
                e.stopPropagation();
            });
            // Double click to restore
            minimizedIcon.addEventListener('dblclick', () => {
                this.hideDesktopIconMenu();
                this.restoreProgramManager();
            });
            const desktopIcons = document.querySelector('.desktop-icons-area');
            if (desktopIcons) {
                desktopIcons.insertBefore(minimizedIcon, desktopIcons.firstChild);
            } else {
                document.querySelector('.screen-content').appendChild(minimizedIcon);
            }
        }
        minimizedIcon.style.display = 'flex';
        
        // Don't add Program Manager to its own taskbar - it's shown as icon at top left
    }

    restoreProgramManager() {
        const programManager = document.querySelector('.program-manager');
        programManager.style.display = 'flex';
        
        const minimizedIcon = document.getElementById('program-manager-minimized');
        if (minimizedIcon) {
            minimizedIcon.style.display = 'none';
            minimizedIcon.classList.remove('selected');
        }
    }

    addToTaskbar(windowId, title, window) {
        const taskbar = document.querySelector('.desktop-taskbar');
        if (!taskbar) return;
        
        // Don't add Program Manager to taskbar - it has its own icon
        if (windowId === 'program-manager') return;
        
        // Only add application windows to taskbar, not program group windows
        if (!window.classList.contains('application-window')) return;
        
        // Check if already in taskbar
        if (this.minimizedWindows.has(windowId)) return;
        
        const taskbarItem = document.createElement('div');
        taskbarItem.className = 'taskbar-item';
        taskbarItem.dataset.windowId = windowId;
        taskbarItem.innerHTML = `
            <div class="taskbar-item-image">
                <div class="mini-window-icon"></div>
            </div>
            <div class="taskbar-item-label">${title}</div>
        `;
        
        // Single click to select and show context menu
        let clickTimeout;
        taskbarItem.addEventListener('click', (e) => {
            // Clear any pending timeout
            clearTimeout(clickTimeout);
            
            // Wait a bit to see if it's a double-click
            clickTimeout = setTimeout(() => {
                // Deselect all other taskbar items
                document.querySelectorAll('.taskbar-item').forEach(item => item.classList.remove('selected'));
                taskbarItem.classList.add('selected');
                
                // Show context menu
                this.showTaskbarItemMenu(taskbarItem, windowId, window, title);
            }, 200);
            
            e.stopPropagation();
        });
        
        // Double click to restore
        taskbarItem.addEventListener('dblclick', () => {
            this.hideTaskbarItemMenu();
            this.restoreFromTaskbar(windowId, window);
        });
        
        taskbar.appendChild(taskbarItem);
        this.minimizedWindows.set(windowId, { window, taskbarItem });
    }

    removeFromTaskbar(windowId) {
        const entry = this.minimizedWindows.get(windowId);
        if (entry) {
            entry.taskbarItem.remove();
            this.minimizedWindows.delete(windowId);
        }
    }

    restoreFromTaskbar(windowId, window) {
        if (window) {
            window.style.display = 'flex';
            
            // Re-setup controls if needed
            if (window.classList.contains('program-group-window') && !window.dataset.controlsSetup) {
                this.setupSingleWindowControls(window);
                this.setupWindowDrag(window);
            }
            
            this.focusWindow(window);
            this.removeFromTaskbar(windowId);
            
        }
    }

    setupGroupIcons() {
        document.querySelectorAll('.group-icon').forEach(icon => {
            // Single click to select
            icon.addEventListener('click', (e) => {
                // Deselect all group icons including minimized Program Manager
                document.querySelectorAll('.group-icon').forEach(i => i.classList.remove('selected'));
                const minimizedPM = document.getElementById('program-manager-minimized');
                if (minimizedPM) {
                    minimizedPM.classList.remove('selected');
                }
                icon.classList.add('selected');
            });

            // Double click to open
            icon.addEventListener('dblclick', (e) => {
                const groupId = icon.dataset.group;
                this.openProgramGroup(groupId);
            });
        });
    }

    setupProgramIcons() {
        document.querySelectorAll('.program-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                document.querySelectorAll('.program-icon').forEach(i => i.classList.remove('selected'));
                icon.classList.add('selected');
            });

            icon.addEventListener('dblclick', (e) => {
                const app = icon.dataset.app;
                if (app === 'minesweeper') {
                    this.openMinesweeper();
                } else if (app === 'skifree') {
                    this.openSkiFree();
                }
            });
        });
    }

    openMinesweeper() {
        const minesweeperApp = document.getElementById('minesweeper-app');
        if (!minesweeperApp) return;

        if (minesweeperApp.style.display === 'none' || !minesweeperApp.style.display) {
            minesweeperApp.style.display = 'flex';
            minesweeperApp.style.left = `${100 + Math.random() * 100}px`;
            minesweeperApp.style.top = `${60 + Math.random() * 50}px`;
            minesweeperApp.style.width = '300px';
            this.setupWindowDrag(minesweeperApp);
            this.setupSingleWindowControls(minesweeperApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('minesweeper-app');
            
            // Initialize game if not already initialized
            if (!minesweeperApp.dataset.initialized) {
                this.initMinesweeper();
                minesweeperApp.dataset.initialized = 'true';
            }
        }
        
        // Always bring to front when opening/clicking
        this.focusWindow(minesweeperApp);
    }

    initMinesweeper() {
        const board = document.getElementById('minesweeper-board');
        const faceButton = document.getElementById('face-button');
        const mineCounter = document.getElementById('mine-counter');
        const timeCounter = document.getElementById('time-counter');
        
        const rows = 9;
        const cols = 9;
        const mines = 10;
        
        let gameBoard = [];
        let revealed = [];
        let flagged = [];
        let gameOver = false;
        let gameWon = false;
        let firstClick = true;
        let timer = 0;
        let timerInterval = null;
        
        // Initialize board
        function initBoard() {
            gameBoard = Array(rows).fill().map(() => Array(cols).fill(0));
            revealed = Array(rows).fill().map(() => Array(cols).fill(false));
            flagged = Array(rows).fill().map(() => Array(cols).fill(false));
            gameOver = false;
            gameWon = false;
            firstClick = true;
            timer = 0;
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = null;
            updateTime();
            updateMineCounter();
            faceButton.textContent = '😊';
        }
        
        // Place mines
        function placeMines(excludeRow, excludeCol) {
            let placed = 0;
            while (placed < mines) {
                const row = Math.floor(Math.random() * rows);
                const col = Math.floor(Math.random() * cols);
                if (gameBoard[row][col] !== -1 && !(row === excludeRow && col === excludeCol)) {
                    gameBoard[row][col] = -1; // -1 = mine
                    placed++;
                }
            }
            
            // Calculate numbers
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (gameBoard[r][c] !== -1) {
                        let count = 0;
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                const nr = r + dr;
                                const nc = c + dc;
                                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && gameBoard[nr][nc] === -1) {
                                    count++;
                                }
                            }
                        }
                        gameBoard[r][c] = count;
                    }
                }
            }
        }
        
        // Render board
        function renderBoard() {
            board.innerHTML = '';
            board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'minesweeper-cell';
                    cell.dataset.row = r;
                    cell.dataset.col = c;
                    
                    if (flagged[r][c]) {
                        cell.textContent = '🚩';
                        cell.classList.add('flagged');
                    } else if (revealed[r][c]) {
                        if (gameBoard[r][c] === -1) {
                            cell.textContent = '💣';
                            cell.classList.add('mine');
                        } else if (gameBoard[r][c] > 0) {
                            cell.textContent = gameBoard[r][c];
                            cell.classList.add('number', `number-${gameBoard[r][c]}`);
                        } else {
                            cell.classList.add('empty');
                        }
                        cell.classList.add('revealed');
                    } else {
                        cell.classList.add('hidden');
                    }
                    
                    cell.addEventListener('click', (e) => handleCellClick(r, c, e));
                    cell.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        handleRightClick(r, c);
                    });
                    
                    board.appendChild(cell);
                }
            }
        }
        
        // Handle cell click
        function handleCellClick(row, col, e) {
            if (gameOver || gameWon || flagged[row][col] || revealed[row][col]) return;
            
            if (firstClick) {
                placeMines(row, col);
                firstClick = false;
                startTimer();
            }
            
            revealCell(row, col);
            checkWin();
        }
        
        // Handle right click (flag)
        function handleRightClick(row, col) {
            if (gameOver || gameWon || revealed[row][col]) return;
            
            flagged[row][col] = !flagged[row][col];
            updateMineCounter();
            renderBoard();
        }
        
        // Reveal cell
        function revealCell(row, col) {
            if (revealed[row][col] || flagged[row][col]) return;
            
            revealed[row][col] = true;
            
            if (gameBoard[row][col] === -1) {
                // Game over
                gameOver = true;
                faceButton.textContent = '😵';
                revealAllMines();
                if (timerInterval) clearInterval(timerInterval);
            } else if (gameBoard[row][col] === 0) {
                // Reveal adjacent cells
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = row + dr;
                        const nc = col + dc;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                            revealCell(nr, nc);
                        }
                    }
                }
            }
            
            renderBoard();
        }
        
        // Reveal all mines
        function revealAllMines() {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (gameBoard[r][c] === -1) {
                        revealed[r][c] = true;
                    }
                }
            }
            renderBoard();
        }
        
        // Check win
        function checkWin() {
            let revealedCount = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (revealed[r][c]) revealedCount++;
                }
            }
            
            if (revealedCount === rows * cols - mines) {
                gameWon = true;
                gameOver = true;
                faceButton.textContent = '😎';
                if (timerInterval) clearInterval(timerInterval);
            }
        }
        
        // Start timer
        function startTimer() {
            timerInterval = setInterval(() => {
                timer++;
                updateTime();
                if (timer >= 999) {
                    clearInterval(timerInterval);
                }
            }, 1000);
        }
        
        // Update time counter
        function updateTime() {
            timeCounter.textContent = String(timer).padStart(3, '0');
        }
        
        // Update mine counter
        function updateMineCounter() {
            let flagCount = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (flagged[r][c]) flagCount++;
                }
            }
            const remaining = mines - flagCount;
            mineCounter.textContent = String(Math.max(0, remaining)).padStart(3, '0');
        }
        
        // Face button click (new game)
        faceButton.addEventListener('click', () => {
            initBoard();
            renderBoard();
        });
        
        // Initialize
        initBoard();
        renderBoard();
    }

    openSkiFree() {
        const skifreeApp = document.getElementById('skifree-app');
        if (!skifreeApp) return;

        if (skifreeApp.style.display === 'none' || !skifreeApp.style.display) {
            skifreeApp.style.display = 'flex';
            skifreeApp.style.left = `${80 + Math.random() * 80}px`;
            skifreeApp.style.top = `${40 + Math.random() * 40}px`;
            skifreeApp.style.width = '420px';
            skifreeApp.style.height = '430px';
            this.setupWindowDrag(skifreeApp);
            this.setupSingleWindowControls(skifreeApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('skifree-app');
            
            // Initialize game if not already initialized
            if (!skifreeApp.dataset.initialized) {
                this.initSkiFree();
                skifreeApp.dataset.initialized = 'true';
            }
        }
        
        // Always bring to front when opening/clicking
        this.focusWindow(skifreeApp);
    }

    initSkiFree() {
        const canvas = document.getElementById('skifree-canvas');
        const ctx = canvas.getContext('2d');
        const distanceEl = document.getElementById('skifree-distance');
        const speedEl = document.getElementById('skifree-speed');
        const restartBtn = document.getElementById('skifree-restart');
        
        // Set fixed canvas dimensions (matches HTML attributes)
        canvas.width = 400;
        canvas.height = 350;
        
        // Load skier image
        const skierImg = new Image();
        skierImg.src = 'assets/skier.png';
        let skierImageLoaded = false;
        skierImg.onload = () => {
            skierImageLoaded = true;
        };
        
        // Game state
        let gameRunning = false;
        let gameOver = false;
        let distance = 0;
        let speed = 3;
        let maxSpeed = 8;
        let turboSpeed = 12;
        let isTurbo = false;
        let isJumping = false;
        let jumpHeight = 0;
        let jumpVelocity = 0;
        
        // Animation state
        let isAnimating = false;
        const startY = -30; // Start off-screen at top
        const targetY = 200; // Lower position (~57% of 350) for more width
        const animationSpeed = 3; // Pixels per frame (faster intro)
        
        // Player state
        const player = {
            x: 200, // Center of 400px canvas
            y: startY, // Start at top for animation
            width: 16,
            height: 20,
            direction: 0, // -1 left, 0 straight, 1 right
            angle: 0
        };
        
        // Obstacles
        let obstacles = [];
        const obstacleTypes = ['tree', 'rock', 'ramp', 'snowman'];
        
        // Yeti
        let yeti = null;
        let yetiAppeared = false;
        const yetiDistance = 2000; // When yeti appears
        
        // Input
        const keys = { left: false, right: false, down: false, fast: false, space: false };
        
        // Generate initial obstacles
        function generateObstacle() {
            const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
            const y = canvas.height + Math.random() * 100;
            
            // Spawn within V-line bounds at this Y position
            const { vanishingPointY, vanishingPointX, bottomLeftX, bottomRightX, bottomY } = V_LINE_PARAMS;
            const t = Math.max(0, (y - vanishingPointY) / (bottomY - vanishingPointY));
            const leftBound = vanishingPointX + (bottomLeftX - vanishingPointX) * t;
            const rightBound = vanishingPointX + (bottomRightX - vanishingPointX) * t;
            
            // Random X within V-line bounds (with small margin)
            const margin = 20;
            const x = (leftBound + margin) + Math.random() * (rightBound - leftBound - margin * 2);
            
            // Base dimensions (will be scaled when drawing)
            const baseWidth = type === 'tree' ? 20 : type === 'rock' ? 24 : type === 'ramp' ? 30 : 18;
            const baseHeight = type === 'tree' ? 30 : type === 'rock' ? 16 : type === 'ramp' ? 12 : 24;
            
            return {
                x: x,
                y: y,
                type: type,
                width: baseWidth,
                height: baseHeight,
                scale: getDistanceScale(y),
                passed: false
            };
        }
        
        // Initialize obstacles
        function initObstacles() {
            obstacles = [];
            for (let i = 0; i < 8; i++) {
                // Start obstacles below the player (player is at Y=200)
                const y = 220 + i * 50 + Math.random() * 30;
                
                // Calculate X within V-line bounds at this Y
                const { vanishingPointY, vanishingPointX, bottomLeftX, bottomRightX, bottomY } = V_LINE_PARAMS;
                const t = Math.max(0, (y - vanishingPointY) / (bottomY - vanishingPointY));
                const leftBound = vanishingPointX + (bottomLeftX - vanishingPointX) * t;
                const rightBound = vanishingPointX + (bottomRightX - vanishingPointX) * t;
                const margin = 20;
                const x = (leftBound + margin) + Math.random() * (rightBound - leftBound - margin * 2);
                
                const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
                const baseWidth = type === 'tree' ? 20 : type === 'rock' ? 24 : type === 'ramp' ? 30 : 18;
                const baseHeight = type === 'tree' ? 30 : type === 'rock' ? 16 : type === 'ramp' ? 12 : 24;
                
                obstacles.push({
                    x: x,
                    y: y,
                    type: type,
                    width: baseWidth,
                    height: baseHeight,
                    scale: getDistanceScale(y),
                    passed: false
                });
            }
        }
        
        // Draw skier
        function drawSkier() {
            ctx.save();
            ctx.translate(player.x, player.y - jumpHeight);
            
            // Shadow when jumping
            if (isJumping) {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(0, jumpHeight + 10, 8, 4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw skier image
            if (skierImageLoaded) {
                const dir = player.direction;
                // Scale down the image - make it slightly smaller
                const scale = 0.045; // 4.5% of original size
                const imgWidth = (skierImg.width || 32) * scale;
                const imgHeight = (skierImg.height || 32) * scale;
                
                // Flip horizontally if going left (original faces right)
                if (dir < 0) {
                    ctx.scale(-1, 1);
                    ctx.drawImage(skierImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                } else {
                    ctx.drawImage(skierImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                }
            } else {
                // Fallback drawing if image not loaded yet
                const dir = player.direction;
                ctx.fillStyle = '#0000AA';
                ctx.fillRect(-4, -8, 8, 12);
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(-3, -14, 6, 6);
            }
            
            ctx.restore();
        }
        
        // Draw tree
        function drawTree(x, y, scale = 1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            
            // Trunk
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-3, 10, 6, 10);
            
            // Foliage (triangles)
            ctx.fillStyle = '#228B22';
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.lineTo(-12, 5);
            ctx.lineTo(12, 5);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(-10, 12);
            ctx.lineTo(10, 12);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        
        // Draw rock
        function drawRock(x, y, scale = 1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            
            ctx.fillStyle = '#696969';
            ctx.beginPath();
            ctx.ellipse(0, 4, 12, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#808080';
            ctx.beginPath();
            ctx.ellipse(-2, 2, 8, 5, -0.3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
        
        // Draw ramp
        function drawRamp(x, y, scale = 1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            
            ctx.fillStyle = '#DEB887';
            ctx.beginPath();
            ctx.moveTo(-15, 6);
            ctx.lineTo(15, 6);
            ctx.lineTo(10, -4);
            ctx.lineTo(-10, -4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Draw snowman
        function drawSnowman(x, y, scale = 1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#CCCCCC';
            ctx.lineWidth = 1;
            // Bottom
            ctx.beginPath();
            ctx.arc(0, 8, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Middle
            ctx.beginPath();
            ctx.arc(0, -2, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Head
            ctx.beginPath();
            ctx.arc(0, -10, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(-2, -11, 2, 2);
            ctx.fillRect(1, -11, 2, 2);
            // Carrot nose
            ctx.fillStyle = '#FFA500';
            ctx.beginPath();
            ctx.moveTo(0, -9);
            ctx.lineTo(5, -8);
            ctx.lineTo(0, -7);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        
        // Draw yeti
        function drawYeti(x, y) {
            // Body
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x - 15, y - 20, 30, 35);
            
            // Head
            ctx.fillRect(x - 10, y - 32, 20, 14);
            
            // Eyes (angry)
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(x - 6, y - 28, 4, 4);
            ctx.fillRect(x + 2, y - 28, 4, 4);
            
            // Mouth
            ctx.fillStyle = '#000';
            ctx.fillRect(x - 5, y - 22, 10, 3);
            
            // Arms
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x - 25, y - 15, 12, 8);
            ctx.fillRect(x + 13, y - 15, 12, 8);
            
            // Legs
            ctx.fillRect(x - 12, y + 15, 10, 10);
            ctx.fillRect(x + 2, y + 15, 10, 10);
            
            // Claws
            ctx.fillStyle = '#333';
            ctx.fillRect(x - 26, y - 14, 3, 6);
            ctx.fillRect(x + 23, y - 14, 3, 6);
        }
        
        // Draw obstacle
        function drawObstacle(obs) {
            switch(obs.type) {
                case 'tree': drawTree(obs.x, obs.y, obs.scale); break;
                case 'rock': drawRock(obs.x, obs.y, obs.scale); break;
                case 'ramp': drawRamp(obs.x, obs.y, obs.scale); break;
                case 'snowman': drawSnowman(obs.x, obs.y, obs.scale); break;
            }
        }
        
        // Check collision
        function checkCollision(obs) {
            if (isJumping && jumpHeight > 15) return false;
            
            const px = player.x;
            const py = player.y;
            const pw = player.width / 2;
            const ph = player.height / 2;
            
            const ox = obs.x;
            const oy = obs.y;
            // Use scaled dimensions for collision (scale is updated in drawObstacle)
            const scale = obs.scale || 1;
            const ow = (obs.width * scale) / 2;
            const oh = (obs.height * scale) / 2;
            
            return px - pw < ox + ow &&
                   px + pw > ox - ow &&
                   py - ph < oy + oh &&
                   py + ph > oy - oh;
        }
        
        // Draw crashed skier
        function drawCrashedSkier() {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(Math.PI / 2);
            
            // Body
            ctx.fillStyle = '#0000AA';
            ctx.fillRect(-6, -4, 12, 8);
            
            // Head
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(-12, -3, 6, 6);
            
            // Skis scattered
            ctx.fillStyle = '#8B4513';
            ctx.save();
            ctx.rotate(0.5);
            ctx.fillRect(8, -8, 4, 12);
            ctx.restore();
            ctx.save();
            ctx.rotate(-0.3);
            ctx.fillRect(10, 4, 4, 12);
            ctx.restore();
            
            ctx.restore();
        }
        
        // Draw eaten skier (by yeti)
        function drawEatenSkier() {
            ctx.fillStyle = '#FF0000';
            ctx.font = '20px serif';
            ctx.textAlign = 'center';
            ctx.fillText('💀', player.x, player.y);
        }
        
        // V-line parameters (fixed coordinates for 400x350 canvas)
        const V_LINE_PARAMS = {
            vanishingPointY: 20,
            vanishingPointX: 200,
            bottomY: 350,
            bottomLeftX: -120,
            bottomRightX: 520
        };
        
        // Get scale factor based on Y position (distance)
        function getDistanceScale(y) {
            const { vanishingPointY, bottomY } = V_LINE_PARAMS;
            // Scale from 0.3 (far/small) to 1.0 (close/large)
            const t = (y - vanishingPointY) / (bottomY - vanishingPointY);
            return 0.3 + Math.max(0, Math.min(1, t)) * 0.7;
        }
        
        // Get X bounds at a given Y position (within V-line)
        function getXBoundsAtY(y) {
            const { vanishingPointY, vanishingPointX, bottomLeftX, bottomRightX, bottomY } = V_LINE_PARAMS;
            const t = Math.max(0, (y - vanishingPointY) / (bottomY - vanishingPointY));
            const leftBound = vanishingPointX + (bottomLeftX - vanishingPointX) * t;
            const rightBound = vanishingPointX + (bottomRightX - vanishingPointX) * t;
            return { left: leftBound, right: rightBound };
        }
        
        // Draw perspective V-line guide (for debugging - can be toggled)
        const showPerspectiveGuide = true; // Set to true to show guide lines
        
        function drawPerspectiveGuide() {
            if (!showPerspectiveGuide) return;
            
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'; // Semi-transparent red
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            const { vanishingPointY, vanishingPointX, bottomLeftX, bottomRightX, bottomY } = V_LINE_PARAMS;
            
            // Draw left line of V
            ctx.moveTo(vanishingPointX, vanishingPointY);
            ctx.lineTo(bottomLeftX, bottomY);
            
            // Draw right line of V
            ctx.moveTo(vanishingPointX, vanishingPointY);
            ctx.lineTo(bottomRightX, bottomY);
            
            ctx.stroke();
        }
        
        // Game loop
        function gameLoop() {
            if (!gameRunning) return;
            
            // Clear canvas (keep background visible through canvas)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw perspective guide V-line
            drawPerspectiveGuide();
            
            // Draw snow texture (dots)
            ctx.fillStyle = '#E8E8E8';
            for (let i = 0; i < 50; i++) {
                const sx = (i * 37 + distance * 0.5) % canvas.width;
                const sy = (i * 23 + distance) % canvas.height;
                ctx.fillRect(sx, sy, 2, 2);
            }
            
            // Handle intro animation
            if (isAnimating) {
                player.y += animationSpeed;
                if (player.y >= targetY) {
                    player.y = targetY;
                    isAnimating = false;
                }
                // Draw skier during animation
                drawSkier();
                requestAnimationFrame(gameLoop);
                return;
            }
            
            if (!gameOver) {
                // Update speed
                const currentMaxSpeed = isTurbo ? turboSpeed : maxSpeed;
                if (keys.down) {
                    speed = Math.min(speed + 0.1, currentMaxSpeed);
                } else if (isTurbo) {
                    speed = Math.min(speed + 0.05, turboSpeed);
                } else {
                    speed = Math.max(3, speed - 0.02);
                }
                
                // Update direction
                if (keys.left) {
                    player.direction = Math.max(-1, player.direction - 0.1);
                } else if (keys.right) {
                    player.direction = Math.min(1, player.direction + 0.1);
                } else {
                    player.direction *= 0.95;
                }
                
                // Move player horizontally (constrained to V-line bounds at player's Y)
                player.x += player.direction * speed * 0.8;
                const bounds = getXBoundsAtY(player.y);
                player.x = Math.max(bounds.left + 15, Math.min(bounds.right - 15, player.x));
                
                // Update jump
                if (isJumping) {
                    jumpHeight += jumpVelocity;
                    jumpVelocity -= 0.8;
                    if (jumpHeight <= 0) {
                        jumpHeight = 0;
                        isJumping = false;
                    }
                }
                
                // Update distance
                distance += speed * 0.5;
                distanceEl.textContent = Math.floor(distance);
                speedEl.textContent = Math.floor(speed * 10);
                
                // Move obstacles (straight down, no horizontal movement)
                for (let obs of obstacles) {
                    obs.y -= speed;
                    
                    // Update scale based on Y position (bigger when closer/lower)
                    obs.scale = getDistanceScale(obs.y);
                    
                    // Check for ramp jump
                    if (obs.type === 'ramp' && !isJumping) {
                        if (checkCollision(obs)) {
                            isJumping = true;
                            jumpVelocity = 8;
                            jumpHeight = 1;
                        }
                    }
                    
                    // Check collision
                    if (obs.type !== 'ramp' && checkCollision(obs)) {
                        gameOver = true;
                    }
                }
                
                // Remove passed obstacles and add new ones
                obstacles = obstacles.filter(obs => obs.y > -50);
                while (obstacles.length < 8) {
                    obstacles.push(generateObstacle());
                }
                
                // Spawn yeti
                if (!yetiAppeared && distance > yetiDistance) {
                    yetiAppeared = true;
                    yeti = {
                        x: player.x,
                        y: canvas.height + 50,
                        speed: speed + 1
                    };
                }
                
                // Update yeti
                if (yeti) {
                    // Yeti chases player
                    const dx = player.x - yeti.x;
                    yeti.x += dx * 0.02;
                    yeti.y -= yeti.speed - speed + 2;
                    
                    // Speed up yeti over time
                    yeti.speed = Math.min(yeti.speed + 0.001, 15);
                    
                    // Check if yeti caught player
                    if (yeti.y < player.y + 30 && Math.abs(yeti.x - player.x) < 25) {
                        gameOver = true;
                    }
                }
            }
            
            // Draw obstacles (sorted by y for proper layering)
            obstacles.sort((a, b) => a.y - b.y);
            for (let obs of obstacles) {
                if (obs.y > -30 && obs.y < canvas.height + 30) {
                    drawObstacle(obs);
                }
            }
            
            // Draw yeti
            if (yeti && yeti.y > -50 && yeti.y < canvas.height + 50) {
                drawYeti(yeti.x, yeti.y);
            }
            
            // Draw player
            if (gameOver) {
                if (yeti && yeti.y < player.y + 50) {
                    drawEatenSkier();
                } else {
                    drawCrashedSkier();
                }
                
                // Game over text
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(canvas.width/2 - 80, canvas.height/2 - 30, 160, 60);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 16px "W95FA", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 5);
                ctx.font = '12px "W95FA", monospace';
                ctx.fillText(`Distance: ${Math.floor(distance)}m`, canvas.width/2, canvas.height/2 + 15);
            } else {
                drawSkier();
            }
            
            requestAnimationFrame(gameLoop);
        }
        
        // Reset game
        function resetGame() {
            distance = 0;
            speed = 3;
            isTurbo = false;
            isJumping = false;
            jumpHeight = 0;
            jumpVelocity = 0;
            player.x = 200; // Center of 400px canvas
            player.y = startY; // Reset to top for animation
            player.direction = 0;
            gameOver = false;
            yetiAppeared = false;
            yeti = null;
            isAnimating = true; // Start intro animation
            initObstacles();
            distanceEl.textContent = '0';
            speedEl.textContent = '0';
            
            if (!gameRunning) {
                gameRunning = true;
                gameLoop();
            }
        }
        
        // Event listeners
        document.addEventListener('keydown', (e) => {
            // Only handle if skifree window is focused
            const skifreeApp = document.getElementById('skifree-app');
            if (!skifreeApp || skifreeApp.style.display === 'none') return;
            if (!skifreeApp.classList.contains('active')) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    keys.left = true;
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    keys.right = true;
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    keys.down = true;
                    e.preventDefault();
                    break;
                case 'f':
                case 'F':
                    isTurbo = true;
                    e.preventDefault();
                    break;
                case ' ':
                    if (!isJumping && !gameOver) {
                        isJumping = true;
                        jumpVelocity = 6;
                        jumpHeight = 1;
                    }
                    e.preventDefault();
                    break;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            switch(e.key) {
                case 'ArrowLeft': keys.left = false; break;
                case 'ArrowRight': keys.right = false; break;
                case 'ArrowDown': keys.down = false; break;
                case 'f':
                case 'F': isTurbo = false; break;
            }
        });
        
        restartBtn.addEventListener('click', resetGame);
        
        // Start game
        resetGame();
    }

    setupSystemMenu() {
        const dropdown = document.getElementById('system-menu-dropdown');
        
        // Setup menu item actions
        dropdown.querySelectorAll('.system-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = item.dataset.action;
                if (item.classList.contains('disabled')) return;
                
                if (action && this.currentWindow) {
                    const isProgramManager = this.currentWindow.classList.contains('program-manager');
                    
                    switch (action) {
                        case 'minimize':
                            if (isProgramManager) {
                                this.minimizeProgramManager();
                            } else {
                                this.minimizeWindow(this.currentWindow);
                            }
                            break;
                        case 'maximize':
                            if (!isProgramManager) {
                                this.toggleMaximize(this.currentWindow);
                            }
                            break;
                        case 'close':
                            if (isProgramManager) {
                                this.minimizeProgramManager();
                            } else {
                                this.currentWindow.style.display = 'none';
                            }
                            break;
                    }
                }
                this.hideSystemMenu();
            });
        });
    }

    setupClickOutside() {
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('system-menu-dropdown');
            if (!e.target.classList.contains('system-menu') && 
                !dropdown.contains(e.target)) {
                this.hideSystemMenu();
            }
        });
    }

    showSystemMenu(win, systemMenuBtn) {
        const dropdown = document.getElementById('system-menu-dropdown');
        this.currentWindow = win;
        
        // Position the dropdown below the system menu button
        const rect = systemMenuBtn.getBoundingClientRect();
        const screenContent = document.querySelector('.screen-content');
        const screenRect = screenContent.getBoundingClientRect();
        
        dropdown.style.left = (rect.left - screenRect.left) + 'px';
        dropdown.style.top = (rect.bottom - screenRect.top) + 'px';
        dropdown.style.display = 'block';
        
        // Update Restore state (disabled if not maximized)
        const restoreItem = dropdown.querySelector('.system-menu-item:first-child');
        if (win.classList.contains('maximized')) {
            restoreItem.classList.remove('disabled');
        } else {
            restoreItem.classList.add('disabled');
        }
    }

    hideSystemMenu() {
        const dropdown = document.getElementById('system-menu-dropdown');
        dropdown.style.display = 'none';
        this.currentWindow = null;
    }

    showDesktopIconMenu(icon, appId) {
        const menu = document.getElementById('desktop-icon-menu');
        if (!menu) return;
        
        // Position menu below the icon
        const rect = icon.getBoundingClientRect();
        const screenContent = document.querySelector('.screen-content');
        const screenRect = screenContent.getBoundingClientRect();
        
        menu.style.left = (rect.left - screenRect.left) + 'px';
        menu.style.top = (rect.bottom - screenRect.top + 2) + 'px';
        menu.style.display = 'block';
        menu.dataset.appId = appId;
        
        // Update menu items based on app state
        const restoreItem = menu.querySelector('[data-action="restore"]');
        const minimizeItem = menu.querySelector('[data-action="minimize"]');
        const maximizeItem = menu.querySelector('[data-action="maximize"]');
        
        if (appId === 'program-manager') {
            const programManager = document.querySelector('.program-manager');
            if (programManager && programManager.style.display === 'none') {
                // Program Manager is minimized - enable Restore, disable Minimize
                restoreItem.classList.remove('disabled');
                if (minimizeItem) minimizeItem.classList.add('disabled');
            } else {
                // Program Manager is open - disable Restore, enable Minimize
                restoreItem.classList.add('disabled');
                if (minimizeItem) minimizeItem.classList.remove('disabled');
            }
            // Maximize is always disabled for Program Manager (it's always maximized)
            if (maximizeItem) maximizeItem.classList.add('disabled');
        } else if (appId === 'ai-assistant') {
            const aiWindow = document.getElementById('ai-assistant-app');
            if (aiWindow && aiWindow.style.display === 'none') {
                // AI Assistant is closed - disable Restore and Minimize
                restoreItem.classList.add('disabled');
                if (minimizeItem) minimizeItem.classList.add('disabled');
            } else {
                // AI Assistant is open - enable Restore and Minimize
                restoreItem.classList.remove('disabled');
                if (minimizeItem) minimizeItem.classList.remove('disabled');
            }
            // Maximize is always disabled for desktop icons (they're not windows)
            if (maximizeItem) maximizeItem.classList.add('disabled');
        }
        
        // Setup menu item handlers
        this.setupDesktopIconMenuHandlers(menu, appId);
    }

    hideDesktopIconMenu() {
        const menu = document.getElementById('desktop-icon-menu');
        if (menu) {
            menu.style.display = 'none';
        }
    }

    showTaskbarItemMenu(taskbarItem, windowId, window, title) {
        const menu = document.getElementById('taskbar-item-menu');
        if (!menu) return;
        
        // Position menu below or above the taskbar item based on position
        const rect = taskbarItem.getBoundingClientRect();
        const screenContent = document.querySelector('.screen-content');
        const screenRect = screenContent.getBoundingClientRect();
        
        menu.style.left = (rect.left - screenRect.left) + 'px';
        
        // Check if there's enough space below - if not, show menu above
        const spaceBelow = screenRect.bottom - rect.bottom;
        const spaceAbove = rect.top - screenRect.top;
        const menuHeight = 200; // Approximate menu height
        
        if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
            // Not enough space below, but enough above - show menu above
            menu.style.top = (rect.top - screenRect.top - menuHeight - 2) + 'px';
        } else {
            // Enough space below - show menu below
            menu.style.top = (rect.bottom - screenRect.top + 2) + 'px';
        }
        
        menu.style.display = 'block';
        menu.dataset.windowId = windowId;
        
        // Update menu items based on window state
        const restoreItem = menu.querySelector('[data-action="restore"]');
        const moveItem = menu.querySelector('[data-action="move"]');
        const minimizeItem = menu.querySelector('[data-action="minimize"]');
        const maximizeItem = menu.querySelector('[data-action="maximize"]');
        
        // Window is minimized, so Restore and Move should be enabled
        if (restoreItem) restoreItem.classList.remove('disabled');
        if (moveItem) moveItem.classList.remove('disabled');
        if (minimizeItem) minimizeItem.classList.add('disabled');
        if (maximizeItem) maximizeItem.classList.add('disabled');
        
        // Setup menu item handlers
        this.setupTaskbarItemMenuHandlers(menu, windowId, window);
    }

    hideTaskbarItemMenu() {
        const menu = document.getElementById('taskbar-item-menu');
        if (menu) {
            menu.style.display = 'none';
        }
    }

    setupTaskbarItemMenuHandlers(menu, windowId, window) {
        // Remove existing handlers to avoid duplicates
        const items = menu.querySelectorAll('.system-menu-item');
        items.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // Restore
        const restoreItem = menu.querySelector('[data-action="restore"]');
        if (restoreItem && !restoreItem.classList.contains('disabled')) {
            restoreItem.addEventListener('click', () => {
                this.hideTaskbarItemMenu();
                this.restoreFromTaskbar(windowId, window);
            });
        }
        
        // Move - disabled for taskbar items (windows are moved by dragging titlebar)
        
        // Close
        const closeItem = menu.querySelector('[data-action="close"]');
        if (closeItem) {
            closeItem.addEventListener('click', () => {
                this.hideTaskbarItemMenu();
                if (window) {
                    window.style.display = 'none';
                    this.removeFromTaskbar(windowId);
                }
            });
        }
        
        // Switch To
        const switchItem = menu.querySelector('[data-action="switch-to"]');
        if (switchItem) {
            switchItem.addEventListener('click', () => {
                this.hideTaskbarItemMenu();
                this.restoreFromTaskbar(windowId, window);
                if (window) {
                    this.focusWindow(window);
                }
            });
        }
    }

    setupDesktopIconMenuHandlers(menu, appId) {
        // Remove existing handlers to avoid duplicates
        const items = menu.querySelectorAll('.system-menu-item');
        items.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // Restore
        const restoreItem = menu.querySelector('[data-action="restore"]');
        if (restoreItem && !restoreItem.classList.contains('disabled')) {
            restoreItem.addEventListener('click', () => {
                this.hideDesktopIconMenu();
                if (appId === 'program-manager') {
                    this.restoreProgramManager();
                } else if (appId === 'ai-assistant') {
                    const aiWindow = document.getElementById('ai-assistant-app');
                    if (aiWindow && aiWindow.style.display === 'none') {
                        this.openAIAssistant();
                    }
                }
            });
        }
        
        // Move - enable move mode for desktop icons
        const moveItem = menu.querySelector('[data-action="move"]');
        if (moveItem) {
            moveItem.classList.remove('disabled');
            moveItem.addEventListener('click', () => {
                this.hideDesktopIconMenu();
                
                // Find the icon element
                let icon;
                if (appId === 'program-manager') {
                    icon = document.querySelector('.minimized-program-manager');
                } else if (appId === 'ai-assistant') {
                    icon = document.querySelector('.desktop-icon[data-app="ai-assistant"]');
                }
                
                if (icon) {
                    // Enable move mode - icon follows cursor
                    icon.dataset.moveMode = 'true';
                    document.body.classList.add('move-mode-active');
                    
                    const moveHandler = (e) => {
                        if (icon.dataset.moveMode !== 'true') {
                            document.removeEventListener('mousemove', moveHandler);
                            return;
                        }
                        
                        const screenContent = document.querySelector('.screen-content');
                        const screenRect = screenContent.getBoundingClientRect();
                        
                        // Center icon on cursor
                        const iconWidth = icon.offsetWidth;
                        const iconHeight = icon.offsetHeight;
                        
                        let newLeft = e.clientX - screenRect.left - iconWidth / 2;
                        let newTop = e.clientY - screenRect.top - iconHeight / 2;
                        
                        // Constrain to screen bounds
                        newLeft = Math.max(0, Math.min(newLeft, screenContent.offsetWidth - iconWidth));
                        newTop = Math.max(0, Math.min(newTop, screenContent.offsetHeight - iconHeight));
                        
                        icon.style.position = 'absolute';
                        icon.style.left = newLeft + 'px';
                        icon.style.top = newTop + 'px';
                    };
                    
                    const placeHandler = (e) => {
                        if (icon.dataset.moveMode === 'true') {
                            delete icon.dataset.moveMode;
                            document.body.classList.remove('move-mode-active');
                            document.removeEventListener('mousemove', moveHandler);
                            document.removeEventListener('click', placeHandler);
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    };
                    
                    document.addEventListener('mousemove', moveHandler);
                    // Use setTimeout to avoid immediate click placement
                    setTimeout(() => {
                        document.addEventListener('click', placeHandler);
                    }, 100);
                }
            });
        }
        
        // Close
        const closeItem = menu.querySelector('[data-action="close"]');
        if (closeItem) {
            closeItem.addEventListener('click', () => {
                this.hideDesktopIconMenu();
                if (appId === 'program-manager') {
                    // Can't close Program Manager, just minimize
                    this.minimizeProgramManager();
                } else if (appId === 'ai-assistant') {
                    const aiWindow = document.getElementById('ai-assistant-app');
                    if (aiWindow) {
                        aiWindow.style.display = 'none';
                        this.removeFromTaskbar('ai-assistant-app');
                    }
                }
            });
        }
        
        // Switch To
        const switchItem = menu.querySelector('[data-action="switch-to"]');
        if (switchItem) {
            switchItem.addEventListener('click', () => {
                this.hideDesktopIconMenu();
                if (appId === 'program-manager') {
                    this.restoreProgramManager();
                    const programManager = document.querySelector('.program-manager');
                    if (programManager) {
                        this.focusWindow(programManager);
                    }
                } else if (appId === 'ai-assistant') {
                    const aiWindow = document.getElementById('ai-assistant-app');
                    if (aiWindow) {
                        if (aiWindow.style.display === 'none') {
                            this.openAIAssistant();
                        }
                        this.focusWindow(aiWindow);
                    }
                }
            });
        }
    }

    toggleMaximize(win) {
        if (win.classList.contains('maximized')) {
            win.classList.remove('maximized');
            win.style.width = '';
            win.style.height = '';
            win.style.left = '';
            win.style.top = '';
        } else {
            win.classList.add('maximized');
            win.style.width = '100%';
            win.style.height = 'calc(100% - 44px)';
            win.style.left = '0';
            win.style.top = '44px';
        }
    }

    openProgramGroup(groupId) {
        const windowId = `${groupId}-window`;
        const win = document.getElementById(windowId);
        
        if (win) {
            if (win.style.display === 'none' || !win.style.display) {
                win.style.display = 'flex';
                win.style.zIndex = ++this.zIndex;
                this.setupWindowDrag(win);
                this.setupSingleWindowControls(win);
                // Remove from taskbar if it was there
                this.removeFromTaskbar(windowId);
            }
            this.focusWindow(win);
        }
    }

    setupSingleWindowControls(win) {
        if (win.dataset.controlsSetup) return;
        win.dataset.controlsSetup = 'true';

        // Focus window when clicking on window content
        const windowContent = win.querySelector('.window-content');
        if (windowContent) {
            windowContent.addEventListener('mousedown', () => {
                this.focusWindow(win);
            });
        }

        const systemMenuBtn = win.querySelector('.system-menu');
        const buttons = win.querySelectorAll('.window-btn');
        const minimizeBtn = buttons[0];
        const maximizeBtn = buttons[1];

        // System menu button - show dropdown
        if (systemMenuBtn) {
            systemMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.focusWindow(win); // Bring to front first
                const dropdown = document.getElementById('system-menu-dropdown');
                if (dropdown.style.display === 'block' && this.currentWindow === win) {
                    this.hideSystemMenu();
                } else {
                    this.showSystemMenu(win, systemMenuBtn);
                }
            });
        }

        // Minimize button
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.minimizeWindow(win);
            });
        }

        // Maximize button
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMaximize(win);
            });
        }

        // Click anywhere on window to bring to front
        win.addEventListener('mousedown', (e) => {
            // Don't focus if clicking on controls
            if (!e.target.classList.contains('window-btn') && 
                !e.target.classList.contains('system-menu') &&
                !e.target.closest('.window-btn') &&
                !e.target.closest('.system-menu')) {
                this.focusWindow(win);
            }
        });
    }

    setupWindowDrag(win) {
        const titlebar = win.querySelector('.window-titlebar');
        if (!titlebar || titlebar.dataset.dragSetup) return;
        titlebar.dataset.dragSetup = 'true';

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        titlebar.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on buttons or system menu
            if (e.target.classList.contains('window-btn') || 
                e.target.closest('.window-btn') ||
                e.target.classList.contains('system-menu') ||
                e.target.closest('.system-menu')) {
                return;
            }
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Get current position relative to screen content
            const rect = win.getBoundingClientRect();
            const screenContent = document.querySelector('.screen-content');
            const screenRect = screenContent.getBoundingClientRect();
            initialLeft = rect.left - screenRect.left;
            initialTop = rect.top - screenRect.top;
            
            this.focusWindow(win);
            e.preventDefault();
        });

        const mousemoveHandler = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const screenContent = document.querySelector('.screen-content');
            const screenRect = screenContent.getBoundingClientRect();
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            
            // Constrain to screen bounds
            const maxX = screenContent.offsetWidth - win.offsetWidth;
            const maxY = screenContent.offsetHeight - win.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            win.style.left = newLeft + 'px';
            win.style.top = newTop + 'px';
            win.style.position = 'absolute';
        };

        document.addEventListener('mousemove', mousemoveHandler);

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    minimizeWindow(win) {
        win.style.display = 'none';
        const title = win.querySelector('.window-title').textContent;
        const windowId = win.id || `window-${Date.now()}`;
        if (!win.id) win.id = windowId;
        this.addToTaskbar(windowId, title, win);
    }

    focusWindow(win) {
        // Remove active from all windows
        document.querySelectorAll('.program-group-window, .application-window').forEach(w => {
            w.classList.remove('active');
        });
        
        // Bring this window to front
        win.classList.add('active');
        win.style.zIndex = ++this.zIndex;
        
        // Deselect desktop icons when focusing a window
        document.querySelectorAll('.desktop-icon, .minimized-program-manager').forEach(i => i.classList.remove('selected'));
        
        // Update taskbar active state
        this.minimizedWindows.forEach((entry, windowId) => {
            if (entry.window === win) {
                entry.taskbarItem.classList.add('active');
            } else {
                entry.taskbarItem.classList.remove('active');
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.programManager = new ProgramManager();
});
