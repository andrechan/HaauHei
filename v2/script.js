// HaauHei考試系統 - 核心邏輯
class HaauHeiExamSystem {
    constructor() {
        this.allQuestions = [];
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.examStarted = false;
        this.totalQuestions = 10;
        this.timeLimit = 1800; // 30分鐘，單位：秒
        this.timeRemaining = this.timeLimit;
        this.timerInterval = null;
        
        this.historyManager = new HistoryManager();
        this.questionEngine = null;
        
        this.init();
    }
    
    async init() {
        await this.loadAllSubjects();
        this.updateSubjectList();
        this.updateLearningStats();
        this.setupEventListeners();
    }
    
    // 載入所有科目文件
    async loadAllSubjects() {
        const loadingElement = document.getElementById('subject-list');
        loadingElement.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 正在載入題庫...</div>';
        
        this.allQuestions = [];
        let index = 1;
        
        while (true) {
            try {
                const filename = `subjects/${index.toString().padStart(4, '0')}.json`;
                const response = await fetch(filename);
                
                if (!response.ok) {
                    break; // 沒有更多文件
                }
                
                const subjectData = await response.json();
                
                // 為每個題目添加唯一ID和科目信息
                subjectData.questions.forEach((question, qIndex) => {
                    question.id = `${index}-${qIndex}`;
                    question.subjectName = subjectData.subjectName;
                    question.subjectIndex = index;
                });
                
                this.allQuestions.push(...subjectData.questions);
                index++;
            } catch (error) {
                console.log(`已載入 ${index-1} 個科目檔案`);
                break;
            }
        }
        
        if (this.allQuestions.length === 0) {
            loadingElement.innerHTML = '<div class="error">未找到任何題目檔案，請確保subjects目錄中有正確的JSON檔案</div>';
        } else {
            this.updateSubjectList();
            this.questionEngine = new SmartQuestionEngine(this.allQuestions, this.historyManager);
        }
    }
    
    // 更新科目列表顯示
    updateSubjectList() {
        const subjectListElement = document.getElementById('subject-list');
        const subjects = new Set(this.allQuestions.map(q => q.subjectName));
        
        if (subjects.size === 0) return;
        
        subjectListElement.innerHTML = '';
        subjects.forEach(subject => {
            const subjectElement = document.createElement('div');
            subjectElement.className = 'subject-tag';
            subjectElement.textContent = subject;
            subjectListElement.appendChild(subjectElement);
        });
    }
    
    // 更新學習統計
    updateLearningStats() {
        const history = this.historyManager.getHistory();
        const totalQuestions = Object.keys(history).length;
        const correctAnswers = Object.values(history).filter(h => h.isCorrect).length;
        const masteredCount = Object.values(history).filter(h => {
            if (!h.isCorrect) return false;
            const daysPassed = (Date.now() - h.lastCorrectTime) / (1000 * 60 * 60 * 24);
            return daysPassed < 10;
        }).length;
        
        document.getElementById('total-answered').textContent = totalQuestions;
        document.getElementById('accuracy-rate').textContent = totalQuestions > 0 ? 
            Math.round((correctAnswers / totalQuestions) * 100) + '%' : '0%';
        document.getElementById('mastered-count').textContent = masteredCount;
    }
    
    // 設置事件監聽器
    setupEventListeners() {
        document.getElementById('question-count').addEventListener('change', (e) => {
            this.totalQuestions = parseInt(e.target.value);
            if (this.totalQuestions > 50) this.totalQuestions = 50;
            if (this.totalQuestions < 1) this.totalQuestions = 1;
            e.target.value = this.totalQuestions;
        });
    }
    
    // 開始考試
    startExam() {
        if (this.allQuestions.length === 0) {
            alert('請先載入題庫！');
            return;
        }
        
        this.totalQuestions = parseInt(document.getElementById('question-count').value);
        if (this.totalQuestions > this.allQuestions.length) {
            this.totalQuestions = this.allQuestions.length;
            document.getElementById('question-count').value = this.totalQuestions;
        }
        
        // 使用智能引擎生成題目
        this.currentQuestions = this.questionEngine.generateWeightedQuestionList(this.totalQuestions);
        this.currentQuestionIndex = 0;
        this.userAnswers = new Array(this.totalQuestions).fill(null);
        this.examStarted = true;
        this.timeRemaining = this.timeLimit;
        
        // 更新界面
        this.showExamScreen();
        this.updateQuestionDisplay();
        this.startTimer();
    }
    
    // 顯示考試界面
    showExamScreen() {
        document.getElementById('welcome-screen').classList.remove('active');
        document.getElementById('exam-screen').classList.add('active');
        document.getElementById('result-screen').classList.remove('active');
    }
    
    // 顯示歡迎界面
    showWelcomeScreen() {
        document.getElementById('welcome-screen').classList.add('active');
        document.getElementById('exam-screen').classList.remove('active');
        document.getElementById('result-screen').classList.remove('active');
        this.updateLearningStats();
    }
    
    // 更新題目顯示
    updateQuestionDisplay() {
        if (this.currentQuestions.length === 0) return;
        
        const question = this.currentQuestions[this.currentQuestionIndex];
        
        // 更新題目信息
        document.getElementById('current-subject').textContent = question.subjectName;
        document.getElementById('current-question').textContent = this.currentQuestionIndex + 1;
        document.getElementById('total-questions').textContent = this.totalQuestions;
        document.getElementById('question-text').textContent = question.question;
        
        // 更新進度條
        const progress = ((this.currentQuestionIndex + 1) / this.totalQuestions) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        
        // 更新選項
        for (let i = 0; i < 4; i++) {
            const optionBtn = document.querySelector(`.option-btn[data-index="${i}"]`);
            const optionText = document.getElementById(`option-${i}`);
            
            optionText.textContent = question.options[i] || `選項${String.fromCharCode(65 + i)}`;
            
            // 重置選中狀態
            optionBtn.classList.remove('selected');
            if (this.userAnswers[this.currentQuestionIndex] === i) {
                optionBtn.classList.add('selected');
            }
        }
        
        // 更新按鈕狀態
        document.getElementById('prev-btn').disabled = this.currentQuestionIndex === 0;
        document.getElementById('next-btn').disabled = this.userAnswers[this.currentQuestionIndex] === null;
        
        // 更新解釋（如果已選擇答案）
        const explanationContainer = document.getElementById('explanation-container');
        const explanationContent = document.getElementById('explanation-content');
        
        if (this.userAnswers[this.currentQuestionIndex] !== null) {
            explanationContent.textContent = question.explanation || '此題目沒有提供解釋。';
            explanationContainer.classList.add('show');
        } else {
            explanationContainer.classList.remove('show');
        }
    }
    
    // 選擇答案
    selectOption(optionIndex) {
        this.userAnswers[this.currentQuestionIndex] = optionIndex;
        
        // 更新選項按鈕狀態
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelector(`.option-btn[data-index="${optionIndex}"]`).classList.add('selected');
        
        // 啟用下一題按鈕
        document.getElementById('next-btn').disabled = false;
        
        // 顯示解釋
        const question = this.currentQuestions[this.currentQuestionIndex];
        const explanationContent = document.getElementById('explanation-content');
        explanationContent.textContent = question.explanation || '此題目沒有提供解釋。';
        document.getElementById('explanation-container').classList.add('show');
    }
    
    // 下一題
    nextQuestion() {
        if (this.currentQuestionIndex < this.totalQuestions - 1) {
            this.currentQuestionIndex++;
            this.updateQuestionDisplay();
        }
    }
    
    // 上一題
    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.updateQuestionDisplay();
        }
    }
    
    // 開始計時器
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                clearInterval(this.timerInterval);
                this.submitExam();
            }
        }, 1000);
    }
    
    // 更新計時器顯示
    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        document.getElementById('exam-timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // 提交考試
    submitExam() {
        clearInterval(this.timerInterval);
        
        // 計算成績
        let correctCount = 0;
        const results = [];
        
        this.currentQuestions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const isCorrect = userAnswer === question.correctAnswer;
            
            if (isCorrect) correctCount++;
            
            // 記錄答題歷史
            this.historyManager.recordAnswer(question.id, isCorrect);
            
            results.push({
                question: question.question,
                options: question.options,
                correctAnswer: question.correctAnswer,
                userAnswer: userAnswer,
                isCorrect: isCorrect,
                explanation: question.explanation,
                subjectName: question.subjectName
            });
        });
        
        // 顯示結果
        this.showResultScreen(correctCount, results);
    }
    
    // 顯示結果界面
    showResultScreen(correctCount, results) {
        const totalCount = results.length;
        const percentage = Math.round((correctCount / totalCount) * 100);
        
        // 更新統計信息
        document.getElementById('correct-count').textContent = correctCount;
        document.getElementById('wrong-count').textContent = totalCount - correctCount;
        document.getElementById('total-count').textContent = totalCount;
        document.getElementById('score-percentage').textContent = `${percentage}%`;
        
        // 生成詳細結果列表
        const resultList = document.getElementById('result-list');
        resultList.innerHTML = '';
        
        results.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = `result-item ${result.isCorrect ? 'correct' : 'wrong'}`;
            
            const answerLabels = ['A', 'B', 'C', 'D'];
            const userAnswerText = result.userAnswer !== null ? 
                answerLabels[result.userAnswer] : '未作答';
            const correctAnswerText = answerLabels[result.correctAnswer];
            
            resultItem.innerHTML = `
                <div class="result-question">
                    <strong>第 ${index + 1} 題</strong> (${result.subjectName})
                </div>
                <div class="result-question-text">${result.question}</div>
                <div class="result-answer">
                    <span>您的答案: <strong class="${result.isCorrect ? 'correct-text' : 'wrong-text'}">${userAnswerText}</strong></span>
                    <span>正確答案: <strong class="correct-text">${correctAnswerText}</strong></span>
                </div>
                <div class="result-explanation">
                    <strong>解釋:</strong> ${result.explanation || '此題目沒有提供解釋。'}
                </div>
            `;
            
            resultList.appendChild(resultItem);
        });
        
        // 切換到結果界面
        document.getElementById('welcome-screen').classList.remove('active');
        document.getElementById('exam-screen').classList.remove('active');
        document.getElementById('result-screen').classList.add('active');
        
        // 更新學習統計
        this.updateLearningStats();
    }
    
    // 重新開始考試
    restartExam() {
        this.showWelcomeScreen();
    }
    
    // 重置學習記錄
    resetHistory() {
        if (confirm('確定要重置所有學習記錄嗎？此操作無法復原。')) {
            this.historyManager.clearHistory();
            this.updateLearningStats();
            alert('學習記錄已重置！');
        }
    }
}

// 歷史記錄管理器
class HistoryManager {
    constructor() {
        this.STORAGE_KEY = 'haauhei_exam_history';
    }
    
    getHistory() {
        const historyJson = localStorage.getItem(this.STORAGE_KEY);
        return historyJson ? JSON.parse(historyJson) : {};
    }
    
    recordAnswer(questionId, isCorrect) {
        const history = this.getHistory();
        
        history[questionId] = {
            questionId: questionId,
            isCorrect: isCorrect,
            lastCorrectTime: isCorrect ? Date.now() : (history[questionId]?.lastCorrectTime || null),
            answerCount: (history[questionId]?.answerCount || 0) + 1,
            lastAttemptTime: Date.now()
        };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    }
    
    getQuestionWeight(questionId) {
        const history = this.getHistory();
        const record = history[questionId];
        
        // 如果沒有記錄或從未答對，權重為1.0
        if (!record || !record.isCorrect) return 1.0;
        
        const daysPassed = (Date.now() - record.lastCorrectTime) / (1000 * 60 * 60 * 24);
        
        // 基於遺忘曲線的權重計算
        if (daysPassed < 10) return 0.0;    // 近期答對，完全避免
        if (daysPassed < 30) return 0.3;   // 近期，低概率
        if (daysPassed < 90) return 0.6;   // 中期，中等概率
        return 1.0;                        // 長期或未答對，高概率
    }
    
    clearHistory() {
        localStorage.removeItem(this.STORAGE_KEY);
    }
}

// 智能出題引擎
class SmartQuestionEngine {
    constructor(allQuestions, historyManager) {
        this.allQuestions = allQuestions;
        this.historyManager = historyManager;
    }
    
    generateWeightedQuestionList(count) {
        if (count >= this.allQuestions.length) {
            // 如果需要的題目數量大於等於總題數，直接返回隨機排序的所有題目
            return this.shuffleArray([...this.allQuestions]).slice(0, count);
        }
        
        // 計算每個題目的權重
        const weightedQuestions = this.allQuestions.map(q => ({
            question: q,
            weight: this.historyManager.getQuestionWeight(q.id)
        }));
        
        // 過濾掉權重為0的題目（近期已掌握）
        const availableQuestions = weightedQuestions.filter(item => item.weight > 0);
        
        if (availableQuestions.length === 0) {
            // 如果所有題目都近期答對，隨機選擇一些
            return this.getRandomQuestions(this.allQuestions, count);
        }
        
        // 根據權重隨機選擇題目
        const selectedQuestions = this.selectByWeight(availableQuestions, count);
        
        // 隨機打亂順序
        return this.shuffleArray(selectedQuestions);
    }
    
    selectByWeight(weightedItems, count) {
        const selected = [];
        const itemsCopy = [...weightedItems];
        
        while (selected.length < count && itemsCopy.length > 0) {
            // 計算總權重
            const totalWeight = itemsCopy.reduce((sum, item) => sum + item.weight, 0);
            
            // 生成隨機數
            let random = Math.random() * totalWeight;
            
            // 根據權重選擇題目
            for (let i = 0; i < itemsCopy.length; i++) {
                random -= itemsCopy[i].weight;
                if (random <= 0) {
                    selected.push(itemsCopy[i].question);
                    itemsCopy.splice(i, 1);
                    break;
                }
            }
        }
        
        return selected;
    }
    
    getRandomQuestions(questions, count) {
        const shuffled = this.shuffleArray([...questions]);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }
    
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}

// 工具函數
function adjustCount(change) {
    const input = document.getElementById('question-count');
    let value = parseInt(input.value) + change;
    if (value < 1) value = 1;
    if (value > 50) value = 50;
    input.value = value;
}

// 初始化系統
let examSystem;

document.addEventListener('DOMContentLoaded', () => {
    examSystem = new HaauHeiExamSystem();
});
