const { createApp } = Vue;

createApp({
    data() {
        return {
            currentMode: 'Work',
            timeLeft: 13 * 60, // seconds
            isRunning: false,
            interval: null,
            showSettings: false,
            showDashboardModal: false,
            settings: {
                title: 'Work',
                work: 13,
                shortBreak: 2,
                longBreak: 10,
                autoStart: false,
                notifications: true,
                sound: true
            },
            completedPomodoros: 0,
            sessionCount: 0,
            sessions: []
        };
    },
    computed: {
        formattedTime() {
            const minutes = Math.floor(this.timeLeft / 60);
            const seconds = this.timeLeft % 60;
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        },
        dashOffset() {
            const totalTime = this.getTotalTimeForMode();
            const progress = (totalTime - this.timeLeft) / totalTime;
            return 0; // no circle
        },
        dynamicTitle() {
            return `${this.currentMode === 'Work' ? this.settings.title : this.currentMode} ${this.formattedTime}`;
        }
    },
    mounted() {
        this.loadSettings();
        this.loadSessions();
        this.resetTimer();
        this.renderChart();
        document.title = this.dynamicTitle;
    },
    watch: {
        dynamicTitle(newTitle) {
            document.title = newTitle;
        }
    },
    methods: {
        getTotalTimeForMode() {
            switch (this.currentMode) {
                case 'Work': return this.settings.work * 60;
                case 'Short Break': return this.settings.shortBreak * 60;
                case 'Long Break': return this.settings.longBreak * 60;
                default: return 0;
            }
        },
        startTimer() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.interval = setInterval(() => {
                this.timeLeft--;
                if (this.timeLeft <= 0) {
                    this.timerFinished();
                }
            }, 1000);
        },
        pauseTimer() {
            this.isRunning = false;
            clearInterval(this.interval);
        },
        resetTimer() {
            this.pauseTimer();
            this.timeLeft = this.getTotalTimeForMode();
        },
        setMode(mode) {
            this.currentMode = mode;
            this.resetTimer();
        },
        timerFinished() {
            this.pauseTimer();
            if (this.settings.notifications) {
                this.showNotification();
            }
            if (this.settings.sound) {
                this.playSound();
            }
            this.switchMode();
            if (this.settings.autoStart) {
                this.startTimer();
            }
        },
        switchMode() {
            if (this.currentMode === 'Work') {
                this.completedPomodoros++;
                if (this.completedPomodoros % 4 === 0) {
                    this.currentMode = 'Long Break';
                } else {
                    this.currentMode = 'Short Break';
                }
            } else {
                this.currentMode = 'Work';
                if (this.currentMode === 'Work' && this.completedPomodoros % 4 === 0) {
                    this.sessionCount++;
                    this.saveSession();
                }
            }
            this.resetTimer();
        },
        showNotification() {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`${this.currentMode} finished!`);
            } else if ('Notification' in window && Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(`${this.currentMode} finished!`);
                    }
                });
            }
        },
        playSound() {
            const audio = new Audio('sounds/ting.mp3');
            audio.play().catch(e => console.log('Sound play failed:', e));
        },
        saveSettings() {
            localStorage.setItem('pomodoroSettings', JSON.stringify(this.settings));
            this.showSettings = false;
            this.resetTimer();
        },
        loadSettings() {
            const saved = localStorage.getItem('pomodoroSettings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        },
        saveSession() {
            const sessions = JSON.parse(localStorage.getItem('pomodoroSessions') || '[]');
            sessions.push({ date: new Date().toISOString(), pomodoros: 4 });
            localStorage.setItem('pomodoroSessions', JSON.stringify(sessions));
            this.loadSessions();
            this.renderChart();
        },
        loadSessions() {
            this.sessions = JSON.parse(localStorage.getItem('pomodoroSessions') || '[]');
            this.sessionCount = this.sessions.length;
            this.completedPomodoros = this.sessions.reduce((sum, s) => sum + s.pomodoros, 0);
        },
        renderChart() {
            const ctx = document.getElementById('chart');
            if (!ctx) return;
            const dates = this.sessions.map(s => new Date(s.date).toLocaleDateString());
            const pomodoros = this.sessions.map(s => s.pomodoros);
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Pomodoros per Session',
                        data: pomodoros,
                        backgroundColor: '#ff6b6b'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }
}).mount('#app');