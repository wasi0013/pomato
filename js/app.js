const { createApp } = Vue;

createApp({
    data() {
        return {
            loading: true,
            currentMode: 'Work',
            timeLeft: 13 * 60, // seconds
            isRunning: false,
            interval: null,
            showSettings: false,
            showDashboardModal: false,
            showLogViewer: false,
            chartInstance: null,
            lineChartInstance: null,
            currentActivity: null,
            activities: [],
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
            sessions: [] // keep for backward compatibility
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
        },
        progressPercent() {
            const totalTime = this.getTotalTimeForMode();
            const elapsed = totalTime - this.timeLeft;
            return Math.min((elapsed / totalTime) * 100, 100);
        }
    },
    mounted() {
        this.loadSettings();
        this.loadActivities();
        this.resetTimer();
        this.renderChart();
        document.title = this.dynamicTitle;
        this.loading = false;
    },
    watch: {
        dynamicTitle(newTitle) {
            document.title = newTitle;
        },
        showDashboardModal(newVal) {
            if (newVal) {
                this.$nextTick(() => {
                    this.renderChart();
                });
            }
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
            if (!this.currentActivity) {
                this.currentActivity = {
                    mode: this.currentMode,
                    title: this.currentMode === 'Work' ? this.settings.title : null,
                    start: new Date().toISOString(),
                    completed: false
                };
            }
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
            if (this.currentActivity && !this.currentActivity.end) {
                this.currentActivity.end = new Date().toISOString();
                this.currentActivity.elapsed = Math.floor((new Date(this.currentActivity.end) - new Date(this.currentActivity.start)) / 1000);
                this.activities.push({ ...this.currentActivity });
                this.saveActivities();
                this.currentActivity = null;
            }
        },
        resetTimer() {
            this.pauseTimer();
            this.timeLeft = this.getTotalTimeForMode();
            this.currentActivity = null; // reset doesn't save
        },
        setMode(mode) {
            if (this.currentActivity) {
                this.currentActivity.end = new Date().toISOString();
                this.currentActivity.elapsed = Math.floor((new Date(this.currentActivity.end) - new Date(this.currentActivity.start)) / 1000);
                this.currentActivity.completed = false; // switched, not completed
                this.activities.push({ ...this.currentActivity });
                this.saveActivities();
            }
            this.currentMode = mode;
            this.currentActivity = {
                mode: this.currentMode,
                title: this.currentMode === 'Work' ? this.settings.title : null,
                start: new Date().toISOString(),
                completed: false
            };
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
            if (this.currentActivity) {
                this.currentActivity.end = new Date().toISOString();
                this.currentActivity.elapsed = this.getTotalTimeForMode();
                this.currentActivity.completed = true;
                this.activities.push({ ...this.currentActivity });
                this.saveActivities();
                this.currentActivity = null;
            }
            this.switchMode();
            if (this.settings.autoStart) {
                this.startTimer();
            }
        },
        switchMode() {
            const prevMode = this.currentMode;
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
            // Complete current activity and start new
            if (this.currentActivity) {
                this.currentActivity.end = new Date().toISOString();
                this.currentActivity.elapsed = Math.floor((new Date(this.currentActivity.end) - new Date(this.currentActivity.start)) / 1000);
                this.currentActivity.completed = true;
                this.activities.push({ ...this.currentActivity });
                this.saveActivities();
            }
            this.currentActivity = {
                mode: this.currentMode,
                title: this.currentMode === 'Work' ? this.settings.title : null,
                start: new Date().toISOString(),
                completed: false
            };
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
        saveActivities() {
            localStorage.setItem('pomodoroActivities', JSON.stringify(this.activities));
        },
        loadActivities() {
            this.activities = JSON.parse(localStorage.getItem('pomodoroActivities') || '[]');
            this.updateStats();
        },
        updateStats() {
            const workActivities = this.activities.filter(a => a.mode === 'Work' && a.completed);
            this.completedPomodoros = workActivities.length;
            this.sessionCount = Math.floor(this.completedPomodoros / 4);
        },
        renderChart() {
            if (this.activities.length === 0) return;

            // Line Chart for Daily Progress
            const lineCtx = document.getElementById('lineChart');
            if (lineCtx) {
                if (this.lineChartInstance) this.lineChartInstance.destroy();
                const dailyData = this.getDailyData();
                this.lineChartInstance = new Chart(lineCtx, {
                    type: 'line',
                    data: {
                        labels: dailyData.labels,
                        datasets: [{
                            label: 'Pomodoros per Day',
                            data: dailyData.data,
                            borderColor: '#ff6b6b',
                            backgroundColor: 'rgba(255, 107, 107, 0.1)',
                            tension: 0.4
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

            // Bar Chart for Session History
            const ctx = document.getElementById('chart');
            if (ctx) {
                if (this.chartInstance) this.chartInstance.destroy();
                this.chartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: this.activities.filter(a => a.mode === 'Work' && a.completed).map(a => new Date(a.start).toLocaleDateString()),
                        datasets: [{
                            label: 'Completed Work Sessions',
                            data: this.activities.filter(a => a.mode === 'Work' && a.completed).map(a => 1),
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
        },
        getDailyData() {
            const daily = {};
            this.activities.filter(a => a.mode === 'Work' && a.completed).forEach(activity => {
                const date = new Date(activity.start).toLocaleDateString();
                daily[date] = (daily[date] || 0) + 1;
            });
            const labels = Object.keys(daily).sort((a, b) => new Date(a) - new Date(b));
            const data = labels.map(date => daily[date]);
            return { labels, data };
        }
    }
}).mount('#app');