// 提醒设置相关函数，适配exam页面

function saveConfig() {
    try {
        // 新增：保存启用提醒总开关
        const reminderEnable = document.getElementById('reminder-enable-toggle').checked;
        setCookie("reminderEnable", reminderEnable, 365);

        if (!reminderEnable) {
            // 关闭提醒时清空提醒队列
            setCookie("examReminders", encodeURIComponent("[]"), 365);
            errorSystem.show('提醒功能已禁用');
            return;
        }

        if (!validateReminders()) {
            return;
        }
        var table = document.getElementById('reminderTable');
        var reminders = [];
        for (var i = 1; i < table.rows.length; i++) {
            var row = table.rows[i];
            var condition = row.cells[0].querySelector('select').value;
            var timeInput = row.cells[1].querySelector('input');
            var audioSelect = row.cells[2].querySelector('select');
            if (timeInput && audioSelect) {
                let timeVal;
                if (condition === 'atTime') {
                    // 存储为 yyyy-mm-ddThh:mm:ss
                    let dt = timeInput.value;
                    if (dt) {
                        let d = new Date(dt);
                        timeVal = d.getFullYear() + '-' +
                            String(d.getMonth() + 1).padStart(2, '0') + '-' +
                            String(d.getDate()).padStart(2, '0') + 'T' +
                            String(d.getHours()).padStart(2, '0') + ':' +
                            String(d.getMinutes()).padStart(2, '0') + ':' +
                            String(d.getSeconds()).padStart(2, '0');
                    } else {
                        timeVal = '';
                    }
                } else {
                    timeVal = timeInput.value || 0;
                }
                reminders.push({
                    condition: condition,
                    time: timeVal,
                    audio: audioSelect.value
                });
            }
        }
        // 允许为空时保存
        setCookie("examReminders", encodeURIComponent(JSON.stringify(reminders)), 365);
        loadRemindersToQueue(reminders);
        errorSystem.show('提醒设置已保存');
    } catch (e) {
        errorSystem.show('保存设置失败: ' + e.message);
    }
}

function loadRemindersToQueue(reminders) {
    // 获取当前或下一个考试
    const examConfig = window.examConfigData;
    if (!examConfig || !Array.isArray(examConfig.examInfos)) return;
    const now = Date.now();
    let targetExam = null;
    for (const exam of examConfig.examInfos) {
        const start = new Date(exam.start).getTime();
        const end = new Date(exam.end).getTime();
        if (now < end) {
            targetExam = exam;
            break;
        }
    }
    if (!targetExam) return;
    reminders.forEach(function(reminder) {
        let reminderTime;
        switch (reminder.condition) {
            case 'beforeStart':
                reminderTime = new Date(targetExam.start).getTime() - reminder.time * 60000;
                break;
            case 'beforeEnd':
                reminderTime = new Date(targetExam.end).getTime() - reminder.time * 60000;
                break;
            case 'afterEnd':
                reminderTime = new Date(targetExam.end).getTime() + reminder.time * 60000;
                break;
            case 'start':
                reminderTime = new Date(targetExam.start).getTime();
                break;
            case 'end':
                reminderTime = new Date(targetExam.end).getTime();
                break;
            case 'atTime':
                // 解析 yyyy-mm-ddThh:mm:ss
                if (reminder.time) {
                    reminderTime = new Date(reminder.time).getTime();
                }
                break;
        }
        if (reminderTime > now) {
            reminderQueue.addReminder({ time: reminderTime, condition: reminder.condition, audio: reminder.audio });
        }
    });
}

function exportConfig() {
    try {
        // 获取考试配置
        let config = null;
        if (window.examConfigData) {
            config = JSON.parse(JSON.stringify(window.examConfigData));
        } else {
            errorSystem.show('未找到考试配置信息');
            return;
        }
        // 获取提醒设置
        const reminderCookie = getCookie("examReminders");
        let reminders = [];
        if (reminderCookie) {
            reminders = JSON.parse(decodeURIComponent(reminderCookie));
        }
        config.examReminders = reminders;
        // 导出为JSON文件
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "exam_config_with_reminders.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        errorSystem.show('配置已导出');
    } catch (e) {
        errorSystem.show('导出配置失败: ' + e.message);
    }
}

// 校验函数，供关闭弹窗和保存时调用
function validateReminders() {
    var table = document.getElementById('reminderTable');
    for (var i = 1; i < table.rows.length; i++) {
        var row = table.rows[i];
        var condition = row.cells[0].querySelector('select').value;
        var timeInput = row.cells[1].querySelector('input');
        if (condition === 'beforeStart' || condition === 'beforeEnd' || condition === 'afterEnd') {
            if (!timeInput.value || isNaN(timeInput.value) || Number(timeInput.value) <= 0) {
                errorSystem.show('请为“距离开始/结束/考试后”类型填写有效的分钟数');
                return false;
            }
        }
        if (condition === 'atTime') {
            if (!timeInput.value) {
                errorSystem.show('请为“当指定时间时”填写时间');
                return false;
            }
        }
    }
    return true;
}

// 页面加载时自动填充提醒表格
document.addEventListener("DOMContentLoaded", () => {
    // 新增：同步启用提醒总开关
    const reminderEnableToggle = document.getElementById('reminder-enable-toggle');
    const reminderEnableCookie = getCookie("reminderEnable");
    reminderEnableToggle.checked = reminderEnableCookie === null ? true : (reminderEnableCookie === "true");

    // 切换开关时禁用/启用表格和导出按钮
    function updateReminderTableState() {
        const disabled = !reminderEnableToggle.checked;
        document.getElementById('reminderTable').querySelectorAll('input,select').forEach(el => {
            el.disabled = disabled;
        });
        document.getElementById('export-config-btn').disabled = disabled;
    }
    reminderEnableToggle.addEventListener('change', updateReminderTableState);
    setTimeout(updateReminderTableState, 0);

    // 加载提醒设置
    const reminderCookie = getCookie("examReminders");
    if (reminderCookie) {
        const reminders = JSON.parse(decodeURIComponent(reminderCookie));
        const table = document.getElementById('reminderTable');
        reminders.forEach(reminder => {
            const row = table.insertRow(table.rows.length);
            const conditionCell = row.insertCell(0);
            const timeCell = row.insertCell(1);
            const audioCell = row.insertCell(2);

            const conditionSelect = document.createElement('select');
            conditionSelect.className = 'reminder-select';
            const options = [
                { value: 'beforeStart', text: '当距离考试开始时间还有' },
                { value: 'beforeEnd', text: '当距离考试结束时间还有' },
                { value: 'afterEnd', text: '当考试结束后' },
                { value: 'start', text: '当考试开始时' },
                { value: 'end', text: '当考试结束时' },
                { value: 'atTime', text: '当指定时间时' }
            ];
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.value;
                opt.textContent = option.text;
                if (option.value === reminder.condition) {
                    opt.selected = true;
                }
                conditionSelect.appendChild(opt);
            });
            conditionCell.appendChild(conditionSelect);

            let timeInput;
            if (reminder.condition === 'start' || reminder.condition === 'end') {
                timeInput = document.createElement('input');
                timeInput.type = 'number';
                timeInput.className = 'reminder-time-input';
                timeInput.placeholder = '-';
                timeInput.disabled = true;
            } else if (reminder.condition === 'atTime') {
                timeInput = document.createElement('input');
                timeInput.type = 'datetime-local';
                timeInput.className = 'reminder-time-input';
                timeInput.placeholder = '时间';
                if (reminder.time) {
                    timeInput.value = reminder.time;
                }
            } else {
                timeInput = document.createElement('input');
                timeInput.type = 'number';
                timeInput.className = 'reminder-time-input';
                timeInput.placeholder = '分钟';
                if (reminder.time) {
                    timeInput.value = reminder.time;
                }
            }
            timeCell.appendChild(timeInput);

            const audioSelect = document.createElement('select');
            audioSelect.name = 'audioSelect';
            audioSelect.className = 'reminder-select';
            fetch('audio_files.json')
              .then(response => response.json())
              .then(audioFiles => {
                    Object.keys(audioFiles).forEach(type => {
                        const option = document.createElement('option');
                        option.value = type;
                        option.textContent = type;
                        if (type === reminder.audio) {
                            option.selected = true;
                        }
                        audioSelect.appendChild(option);
                    });
                });
            audioCell.appendChild(audioSelect);

            // 监听类型切换
            conditionSelect.addEventListener('change', function() {
                const selectVal = this.value;
                if (selectVal === 'start' || selectVal === 'end') {
                    timeCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="-" disabled>`;
                } else if (selectVal === 'atTime') {
                    timeCell.innerHTML = `<input type="datetime-local" class="reminder-time-input" placeholder="时间">`;
                } else {
                    timeCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="分钟">`;
                }
            });
        });
    }
});
