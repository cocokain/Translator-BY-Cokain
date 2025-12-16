// 言語コード
const languageNames = {
    ja: '日本語',
    en: 'English',
    zh: '中文',
    ko: '한국어',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    pt: 'Português',
    ru: 'Русский'
};

// 翻訳API設定
const USE_LIBRE_TRANSLATE = true;
// CORS対応の無料翻訳API
const LIBRE_TRANSLATE_API = 'https://api.mymemory.translated.net/get';

// サンプル翻訳データ（APIが使えない場合のフォールバック）
const sampleTranslations = {
    'ja-en': {
        'こんにちは': 'Hello',
        'ありがとう': 'Thank you',
        'さようなら': 'Goodbye',
        'おはよう': 'Good morning',
        'こんばんは': 'Good evening',
        '愛してる': 'I love you',
        'すみません': 'Excuse me',
        '元気ですか': 'How are you?',
        'お疲れ様です': 'Thank you for your hard work',
        '大丈夫ですか': 'Are you okay?'
    },
    'en-ja': {
        'hello': 'こんにちは',
        'thank you': 'ありがとう',
        'goodbye': 'さようなら',
        'good morning': 'おはよう',
        'good evening': 'こんばんは',
        'i love you': '愛してる',
        'excuse me': 'すみません',
        'how are you': '元気ですか',
        'thank you for your hard work': 'お疲れ様です',
        'are you okay': '大丈夫ですか'
    },
    'en-zh': {
        'hello': '你好',
        'thank you': '谢谢',
        'goodbye': '再见',
        'good morning': '早上好',
        'good evening': '晚上好',
        'how are you': '你好吗'
    },
    'zh-en': {
        '你好': 'hello',
        '谢谢': 'thank you',
        '再见': 'goodbye',
        '早上好': 'good morning'
    }
};

// DOM要素の取得
const sourceText = document.getElementById('source-text');
const targetText = document.getElementById('target-text');
const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const translateBtn = document.getElementById('translate-btn');
const swapBtn = document.getElementById('swap-btn');
const clearBtn = document.getElementById('clear-source');
const copyBtn = document.getElementById('copy-btn');
const charCount = document.getElementById('char-count');
const statusMessage = document.getElementById('status-message');
const historyList = document.getElementById('history-list');

// 翻訳履歴
let translationHistory = JSON.parse(localStorage.getItem('translationHistory')) || [];

// イベントリスナー
translateBtn.addEventListener('click', translate);
swapBtn.addEventListener('click', swapLanguages);
clearBtn.addEventListener('click', clearSource);
copyBtn.addEventListener('click', copyToClipboard);
sourceText.addEventListener('input', updateCharCount);
sourceText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        translate();
    }
});

// 文字数カウント更新
function updateCharCount() {
    const count = sourceText.value.length;
    charCount.textContent = count;
    
    if (count > 5000) {
        sourceText.value = sourceText.value.substring(0, 5000);
        charCount.textContent = 5000;
    }
}

// 言語を入れ替え
function swapLanguages() {
    const temp = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = temp;
    
    const tempText = sourceText.value;
    sourceText.value = targetText.value;
    targetText.value = tempText;
    
    updateCharCount();
}

// ソーステキストをクリア
function clearSource() {
    sourceText.value = '';
    sourceText.focus();
    updateCharCount();
}

// クリップボードにコピー
function copyToClipboard() {
    if (!targetText.value) {
        showStatus('コピーするテキストがありません', 'error');
        return;
    }
    
    navigator.clipboard.writeText(targetText.value).then(() => {
        showStatus('コピーしました！', 'success');
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 2000);
    }).catch(() => {
        showStatus('コピーに失敗しました', 'error');
    });
}

// ステータスメッセージを表示
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
}

// 翻訳実行
async function translate() {
    const source = sourceText.value.trim();
    
    if (!source) {
        showStatus('テキストを入力してください', 'error');
        return;
    }
    
    if (source.length > 5000) {
        showStatus('5000文字以内で入力してください', 'error');
        return;
    }
    
    const srcLang = sourceLang.value;
    const tgtLang = targetLang.value;
    
    if (srcLang === tgtLang) {
        showStatus('異なる言語を選択してください', 'error');
        return;
    }
    
    translateBtn.disabled = true;
    showStatus('翻訳中...', 'loading');
    
    try {
        const result = await performTranslation(source, srcLang, tgtLang);
        
        if (result && result.trim()) {
            targetText.value = result;
            showStatus('翻訳完了！', 'success');
            
            // 履歴に追加
            addToHistory(source, result, srcLang, tgtLang);
            
            setTimeout(() => {
                statusMessage.textContent = '';
            }, 2000);
        } else {
            showStatus('翻訳に失敗しました。別の言語の組み合わせをお試しください。', 'error');
        }
    } catch (error) {
        console.error('翻訳エラー:', error);
        showStatus('翻訳に失敗しました。もう一度お試しください。', 'error');
    } finally {
        translateBtn.disabled = false;
    }
}

// 言語コード変換（LibreTranslate用）
function convertLanguageCode(code) {
    const codeMap = {
        'ja': 'ja',
        'en': 'en',
        'zh': 'zh',
        'ko': 'ko',
        'es': 'es',
        'fr': 'fr',
        'de': 'de',
        'it': 'it',
        'pt': 'pt',
        'ru': 'ru'
    };
    return codeMap[code] || code;
}

// 翻訳処理
async function performTranslation(text, srcLang, tgtLang) {
    const key = `${srcLang}-${tgtLang}`;
    
    // サンプルデータから検索（短いテキストの場合）
    if (text.length < 100 && sampleTranslations[key] && sampleTranslations[key][text.toLowerCase()]) {
        return sampleTranslations[key][text.toLowerCase()];
    }
    
    // LibreTranslate APIを使用
    if (USE_LIBRE_TRANSLATE) {
        try {
            return await translateWithLibreTranslate(text, srcLang, tgtLang);
        } catch (error) {
            console.error('LibreTranslate エラー:', error);
            return fallbackTranslation(text);
        }
    }
    
    return fallbackTranslation(text);
}

// LibreTranslate APIで翻訳
async function translateWithLibreTranslate(text, sourceLang, targetLang) {
    const srcCode = convertLanguageCode(sourceLang);
    const tgtCode = convertLanguageCode(targetLang);
    
    try {
        // MyMemory翻訳APIを使用（CORS対応で無料）
        const encodedText = encodeURIComponent(text);
        const url = `${LIBRE_TRANSLATE_API}?q=${encodedText}&langpair=${srcCode}|${tgtCode}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
            return data.responseData.translatedText;
        } else if (data.responseStatus === 403) {
            // 翻訳不可の場合はサンプルデータを使用
            const key = `${sourceLang}-${targetLang}`;
            if (sampleTranslations[key] && sampleTranslations[key][text.toLowerCase()]) {
                return sampleTranslations[key][text.toLowerCase()];
            }
            return text;
        }
        
        return text;
    } catch (error) {
        console.error('翻訳エラー:', error);
        // フォールバック：サンプルデータから探す
        const key = `${sourceLang}-${targetLang}`;
        if (sampleTranslations[key] && sampleTranslations[key][text.toLowerCase()]) {
            return sampleTranslations[key][text.toLowerCase()];
        }
        throw error;
    }
}

// フォールバック翻訳（APIが失敗した場合）
function fallbackTranslation(text) {
    return text;
}

// 翻訳履歴に追加
function addToHistory(source, result, srcLang, tgtLang) {
    const historyItem = {
        id: Date.now(),
        source: source.substring(0, 50),
        result: result.substring(0, 50),
        srcLang: srcLang,
        tgtLang: tgtLang,
        timestamp: new Date().toLocaleString('ja-JP')
    };
    
    translationHistory.unshift(historyItem);
    
    if (translationHistory.length > 20) {
        translationHistory.pop();
    }
    
    localStorage.setItem('translationHistory', JSON.stringify(translationHistory));
    renderHistory();
}

// 履歴をレンダリング
function renderHistory() {
    historyList.innerHTML = '';
    
    if (translationHistory.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #999; padding: 12px;">翻訳履歴はまだありません</p>';
        return;
    }
    
    translationHistory.forEach(item => {
        const historyElement = document.createElement('div');
        historyElement.className = 'history-item';
        historyElement.innerHTML = `
            <div class="history-text">
                <div class="history-source">${item.source}</div>
                <div class="history-content">${item.result}</div>
            </div>
            <span class="history-lang">${languageNames[item.srcLang]} → ${languageNames[item.tgtLang]}</span>
        `;
        
        historyElement.addEventListener('click', () => {
            sourceText.value = item.source;
            sourceLang.value = item.srcLang;
            targetLang.value = item.tgtLang;
            updateCharCount();
            translate();
        });
        
        historyList.appendChild(historyElement);
    });
}

// 初期化
renderHistory();

// 実際のGoogle翻訳API統合の例（コメント）
/*
// Google Cloud Translation API を使用する場合:
async function translateWithGoogleAPI(text, sourceLanguage, targetLanguage) {
    const apiKey = 'YOUR_GOOGLE_API_KEY';
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: text,
                source_language: sourceLanguage,
                target_language: targetLanguage
            })
        });
        
        const data = await response.json();
        return data.data.translations[0].translatedText;
    } catch (error) {
        console.error('翻訳エラー:', error);
        return 'エラーが発生しました';
    }
}
*/
