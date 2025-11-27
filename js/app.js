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
            showShortcuts: false,
            showAbout: false,
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
            settingsDraft: null,
            completedPomodoros: 0,
            sessionCount: 0,
            totalWorkMinutes: 0,
            totalBreakMinutes: 0,
            totalBreaksTaken: 0,
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
            // Include a small emoji to make mode changes more noticeable in the document title
            let emoji = '⏱️';
            if (this.currentMode === 'Work') emoji = '';
            else if (this.currentMode === 'Short Break') emoji = '☕';
            else if (this.currentMode === 'Long Break') emoji = '⏱️';
            const label = this.currentMode === 'Work' ? 'Work' : this.currentMode;
            return `${emoji} ${label} ${this.formattedTime}`;
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
        // apply initial mode class to body for themed backgrounds
        this.applyModeClass(this.currentMode);
        // register keyboard shortcut for play/pause (Space)
        window.addEventListener('keydown', this.onKeydown);
        this.loading = false;
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onKeydown);
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
        ,
        currentMode(newMode) {
            this.applyModeClass(newMode);
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
            const now = new Date().toISOString();
            if (!this.currentActivity) {
                this.currentActivity = {
                    mode: this.currentMode,
                    title: this.currentMode === 'Work' ? this.settings.title : null,
                    start: now,
                    segments: [], // array of {start,end,elapsed}
                    elapsed: 0,
                    completed: false,
                    segmentStart: now
                };
                // add draft activity to activities so it can be shown/updated
                this.activities.push({ ...this.currentActivity });
                this.saveActivities();
            } else {
                // resuming: start a new segment
                this.currentActivity.segmentStart = now;
                // update the activities array entry (last one)
                const last = this.activities[this.activities.length - 1];
                if (last && last.start === this.currentActivity.start) {
                    last.segmentStart = now;
                    this.saveActivities();
                }
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
            const now = new Date().toISOString();
            if (this.currentActivity && this.currentActivity.segmentStart) {
                const segStart = new Date(this.currentActivity.segmentStart);
                const segEnd = new Date(now);
                const segElapsed = Math.floor((segEnd - segStart) / 1000);
                // add segment
                this.currentActivity.segments.push({ start: this.currentActivity.segmentStart, end: now, elapsed: segElapsed });
                this.currentActivity.elapsed = (this.currentActivity.elapsed || 0) + segElapsed;
                this.currentActivity.segmentStart = null;
                // update activities array (last entry)
                const last = this.activities[this.activities.length - 1];
                if (last && last.start === this.currentActivity.start) {
                    last.segments = this.currentActivity.segments.slice();
                    last.elapsed = this.currentActivity.elapsed;
                    last.segmentStart = null;
                    last.completed = false;
                } else {
                    // push if not present
                    this.activities.push({ ...this.currentActivity });
                }
                this.saveActivities();
            }
        },
        resetTimer() {
            // on reset we discard the current activity (do not save incomplete draft)
            clearInterval(this.interval);
            this.isRunning = false;
            this.timeLeft = this.getTotalTimeForMode();
            if (this.currentActivity) {
                // remove the draft activity from activities if present and not completed
                const idx = this.activities.findIndex(a => a.start === this.currentActivity.start && !a.completed);
                if (idx !== -1) {
                    this.activities.splice(idx, 1);
                    this.saveActivities();
                }
            }
            this.currentActivity = null; // reset doesn't save
        },
        setMode(mode) {
            // switching mode: finalize any current segment and mark as not completed
            const now = new Date().toISOString();
            if (this.currentActivity) {
                if (this.currentActivity.segmentStart) {
                    const segStart = new Date(this.currentActivity.segmentStart);
                    const segEnd = new Date(now);
                    const segElapsed = Math.floor((segEnd - segStart) / 1000);
                    this.currentActivity.segments.push({ start: this.currentActivity.segmentStart, end: now, elapsed: segElapsed });
                    this.currentActivity.elapsed = (this.currentActivity.elapsed || 0) + segElapsed;
                    this.currentActivity.segmentStart = null;
                }
                this.currentActivity.end = now;
                this.currentActivity.completed = false; // switched, not completed
                // update or push
                const last = this.activities[this.activities.length - 1];
                if (last && last.start === this.currentActivity.start) {
                    Object.assign(last, { ...this.currentActivity });
                } else {
                    this.activities.push({ ...this.currentActivity });
                }
                this.saveActivities();
                this.currentActivity = null;
            }
            this.currentMode = mode;
            this.currentActivity = {
                mode: this.currentMode,
                title: this.currentMode === 'Work' ? this.settings.title : null,
                start: new Date().toISOString(),
                segments: [],
                elapsed: 0,
                completed: false,
                segmentStart: null
            };
            this.resetTimer();
        },
        timerFinished() {
            clearInterval(this.interval);
            this.isRunning = false;
            const now = new Date().toISOString();

            // finalize any running segment and mark completed
            if (this.currentActivity) {
                if (this.currentActivity.segmentStart) {
                    const segStart = new Date(this.currentActivity.segmentStart);
                    const segEnd = new Date(now);
                    const segElapsed = Math.floor((segEnd - segStart) / 1000);
                    this.currentActivity.segments.push({ start: this.currentActivity.segmentStart, end: now, elapsed: segElapsed });
                    this.currentActivity.elapsed = (this.currentActivity.elapsed || 0) + segElapsed;
                    this.currentActivity.segmentStart = null;
                }
                this.currentActivity.end = now;
                this.currentActivity.completed = true;
                // update last or push
                const last = this.activities[this.activities.length - 1];
                if (last && last.start === this.currentActivity.start) {
                    Object.assign(last, { ...this.currentActivity });
                } else {
                    this.activities.push({ ...this.currentActivity });
                }
                this.saveActivities();
                this.currentActivity = null;
            }

            if (this.settings.notifications) this.showNotification();
            if (this.settings.sound) this.playSound();

            this.switchMode();
            if (this.settings.autoStart) this.startTimer();
        },
        switchMode() {
            // Determine next mode using completed work activities
            const completedWork = this.activities.filter(a => a.mode === 'Work' && a.completed).length;
            if (this.currentMode === 'Work') {
                // after work go to break; choose long break when completedWork is multiple of sessionsBeforeLong
                if (this.settings.sessionsBeforeLong && (completedWork % this.settings.sessionsBeforeLong) === 0 && completedWork > 0) {
                    this.currentMode = 'Long Break';
                } else {
                    this.currentMode = 'Short Break';
                }
            } else {
                this.currentMode = 'Work';
            }

            // If any current activity still exists (rare), finalize it
            if (this.currentActivity && !this.currentActivity.end) {
                const now = new Date().toISOString();
                if (this.currentActivity.segmentStart) {
                    const segStart = new Date(this.currentActivity.segmentStart);
                    const segEnd = new Date(now);
                    const segElapsed = Math.floor((segEnd - segStart) / 1000);
                    this.currentActivity.segments.push({ start: this.currentActivity.segmentStart, end: now, elapsed: segElapsed });
                    this.currentActivity.elapsed = (this.currentActivity.elapsed || 0) + segElapsed;
                    this.currentActivity.segmentStart = null;
                }
                this.currentActivity.end = now;
                this.currentActivity.completed = true;
                const last = this.activities[this.activities.length - 1];
                if (last && last.start === this.currentActivity.start) {
                    Object.assign(last, { ...this.currentActivity });
                } else {
                    this.activities.push({ ...this.currentActivity });
                }
                this.saveActivities();
                this.currentActivity = null;
            }

            // start a fresh activity for the new mode
            this.currentActivity = {
                mode: this.currentMode,
                title: this.currentMode === 'Work' ? this.settings.title : null,
                start: new Date().toISOString(),
                segments: [],
                elapsed: 0,
                completed: false,
                segmentStart: null
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
        // Open settings modal using a draft copy so edits are safe until committed
        openSettings() {
            // deep copy to avoid mutating the live settings prematurely
            this.settingsDraft = JSON.parse(JSON.stringify(this.settings || {}));
            this.showSettings = true;
        },
        // Commit draft into live settings and persist
        commitSettings() {
            if (!this.settingsDraft) return;
            this.settings = { ...this.settings, ...this.settingsDraft };
            this.saveSettings();
            this.settingsDraft = null;
            this.showSettings = false;
            // ensure timer length reflects new settings
            this.resetTimer();
        },
        // Cancel editing settings
        cancelSettings() {
            this.settingsDraft = null;
            this.showSettings = false;
        },
        loadSettings() {
            const saved = localStorage.getItem('pomodoroSettings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        },
        saveActivities() {
            localStorage.setItem('pomodoroActivities', JSON.stringify(this.activities));
            // update derived stats and refresh visualizations
            this.updateStats();
            this.renderChart();
        },
        loadActivities() {
            this.activities = JSON.parse(localStorage.getItem('pomodoroActivities') || '[]');
            this.updateStats();
        },
        updateStats() {
            const workActivities = this.activities.filter(a => a.mode === 'Work' && a.completed);
            const breakActivities = this.activities.filter(a => (a.mode === 'Short Break' || a.mode === 'Long Break') && a.completed);
            this.completedPomodoros = workActivities.length;
            this.sessionCount = Math.floor(this.completedPomodoros / 4);
            // total minutes of completed work and breaks (elapsed stored in seconds)
            this.totalWorkMinutes = Math.round(workActivities.reduce((sum, a) => sum + (a.elapsed || 0), 0) / 60);
            this.totalBreakMinutes = Math.round(breakActivities.reduce((sum, a) => sum + (a.elapsed || 0), 0) / 60);
            this.totalBreaksTaken = breakActivities.length;
        },
        applyModeClass(mode) {
            // normalize mode into class names
            const map = {
                'Work': 'mode-work',
                'Short Break': 'mode-short-break',
                'Long Break': 'mode-long-break'
            };
            const cls = map[mode] || 'mode-work';
            document.body.classList.remove('mode-work', 'mode-short-break', 'mode-long-break');
            document.body.classList.add(cls);
        },
        // Format minutes into "Hh Mm" or "Xm" string
        formatMinutes(totalMinutes) {
            if (!totalMinutes || totalMinutes <= 0) return '0m';
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            if (hours > 0) return `${hours}h ${mins}m`;
            return `${mins}m`;
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
                // animate canvas (reflow then add class)
                try {
                    lineCtx.classList.remove('chart-appear');
                    void lineCtx.offsetWidth;
                    lineCtx.classList.add('chart-appear');
                } catch (e) { /* ignore if DOM not ready */ }
            }

            // Bar Chart for Session History (aggregate by day)
            const ctx = document.getElementById('chart');
            if (ctx) {
                if (this.chartInstance) this.chartInstance.destroy();
                const dailyData = this.getDailyData();
                this.chartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: dailyData.labels,
                        datasets: [{
                            label: 'Completed Work Sessions',
                            data: dailyData.data,
                            backgroundColor: dailyData.data.map(() => '#ff6b6b')
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { precision: 0 }
                            }
                        }
                    }
                });
                try {
                    ctx.classList.remove('chart-appear');
                    void ctx.offsetWidth;
                    ctx.classList.add('chart-appear');
                } catch (e) { /* ignore if DOM not ready */ }
            }
        },
        onKeydown(event) {
            // Toggle start/pause with Spacebar
            if (event.code === 'Space' || event.key === ' ') {
                // ignore when modals are open
                if (this.showSettings || this.showDashboardModal || this.showLogViewer) return;
                const active = document.activeElement;
                if (active) {
                    const tag = (active.tagName || '').toUpperCase();
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) return;
                }
                event.preventDefault();
                if (this.isRunning) this.pauseTimer();
                else this.startTimer();
            }

            // Left/Right arrows: switch tabs in natural order (Work -> Short Break -> Long Break)
            if (event.code === 'ArrowRight' || event.code === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                // ignore when modals are open
                if (this.showSettings || this.showDashboardModal || this.showLogViewer) return;
                const active = document.activeElement;
                if (active) {
                    const tag = (active.tagName || '').toUpperCase();
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) return;
                }
                const modes = ['Work', 'Short Break', 'Long Break'];
                const cur = modes.indexOf(this.currentMode) !== -1 ? modes.indexOf(this.currentMode) : 0;
                let next = cur;
                if (event.code === 'ArrowRight' || event.key === 'ArrowRight') next = (cur + 1) % modes.length;
                if (event.code === 'ArrowLeft' || event.key === 'ArrowLeft') next = (cur - 1 + modes.length) % modes.length;
                if (next !== cur) {
                    event.preventDefault();
                    this.setMode(modes[next]);
                }
            }

            // Reset shortcut: plain 'r' (no modifiers) — avoid Ctrl/Shift/Cmd combos
            if ((event.key && event.key.toLowerCase() === 'r') && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
                // ignore when modals are open
                if (this.showSettings || this.showDashboardModal || this.showLogViewer) return;
                const active = document.activeElement;
                if (active) {
                    const tag = (active.tagName || '').toUpperCase();
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) return;
                }
                // perform reset
                event.preventDefault();
                this.resetTimer();
            }

            // Additional shortcuts: N = switch mode, S = settings, D = dashboard, L = log
            // Only trigger on plain key presses (no modifiers) and when focus isn't in a form control.
            const key = (event.key || '').toLowerCase();
            const noModifiers = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
            if (noModifiers && key) {
                const activeEl = document.activeElement;
                if (activeEl) {
                    const t = (activeEl.tagName || '').toUpperCase();
                    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || activeEl.isContentEditable) return;
                }

                // N: switch mode (only when no modal open)
                if (key === 'n') {
                    if (!(this.showSettings || this.showDashboardModal || this.showLogViewer)) {
                        event.preventDefault();
                        this.switchMode();
                    }
                }

                // S: toggle settings (allow closing if it's already open)
                if (key === 's') {
                    if (!(this.showDashboardModal || this.showLogViewer) || this.showSettings) {
                        event.preventDefault();
                        // use openSettings/cancelSettings so the draft model is created/cleared correctly
                        if (this.showSettings) this.cancelSettings();
                        else this.openSettings();
                    }
                }

                // D: toggle dashboard (update chart when opening)
                if (key === 'd') {
                    if (!(this.showSettings || this.showLogViewer) || this.showDashboardModal) {
                        event.preventDefault();
                        this.showDashboardModal = !this.showDashboardModal;
                        if (this.showDashboardModal) this.$nextTick(() => this.renderChart());
                    }
                }

                // L: toggle log viewer
                if (key === 'l') {
                    if (!(this.showSettings || this.showDashboardModal) || this.showLogViewer) {
                        event.preventDefault();
                        this.showLogViewer = !this.showLogViewer;
                    }
                }

                // H: show shortcuts modal
                if (key === 'h') {
                    if (!(this.showSettings || this.showDashboardModal || this.showLogViewer) || this.showShortcuts) {
                        event.preventDefault();
                        if (this.showShortcuts) this.closeShortcuts();
                        else this.openShortcuts();
                    }
                }
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
        ,
        openShortcuts() {
            this.showShortcuts = true;
        },
        closeShortcuts() {
            this.showShortcuts = false;
        },
        openAbout() {
            this.showAbout = true;
        },
        closeAbout() {
            this.showAbout = false;
        }
    }
}).mount('#app');