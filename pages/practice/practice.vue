<template>
  <view class="practice-page" :class="currentTheme">
    <theme-toggle-fab :theme="currentTheme" />
    <view class="practice-shell">
      <view class="practice-topbar">
        <view class="practice-home-btn" @tap="goToday">
          <text>返回主页</text>
        </view>
      </view>

      <view class="practice-hero">
        <view class="practice-hero__top">
          <view class="practice-hero__intro">
            <text class="practice-hero__eyebrow">TODAY REVIEW</text>
            <text class="practice-hero__title">{{ heroTitle }}</text>
            <text class="practice-hero__subtitle">{{ heroSubtitle }}</text>
          </view>

          <view class="practice-hero__badge">
            <text class="practice-hero__badge-value">{{ solvedCount }}</text>
            <text class="practice-hero__badge-label">SOLVED</text>
          </view>
        </view>

        <view class="practice-summary">
          <view class="practice-summary__item">
            <text class="practice-summary__value">{{ initialQueueSize }}</text>
            <text class="practice-summary__label">总任务</text>
          </view>
          <view class="practice-summary__item">
            <text class="practice-summary__value">{{ remainingCount }}</text>
            <text class="practice-summary__label">剩余</text>
          </view>
          <view class="practice-summary__item">
            <text class="practice-summary__value">{{ sessionProgressLabel }}</text>
            <text class="practice-summary__label">进度</text>
          </view>
        </view>
      </view>

      <view v-if="isComplete" class="state-card">
        <text class="state-card__eyebrow">SESSION COMPLETE</text>
        <text class="state-card__title">{{
          initialQueueSize ? '本轮复习完成' : '今天没有待复习内容'
        }}</text>
        <text class="state-card__desc">{{ completionText }}</text>

        <view class="state-card__stats">
          <view class="state-stat">
            <text class="state-stat__value">{{ solvedCount }}</text>
            <text class="state-stat__label">已解决</text>
          </view>
          <view class="state-stat">
            <text class="state-stat__value">{{ initialQueueSize }}</text>
            <text class="state-stat__label">总任务</text>
          </view>
        </view>

        <view class="state-card__actions">
          <view class="action-button action-button--primary" @tap="goToday">
            <text>回 Today</text>
          </view>
          <view class="action-button action-button--secondary" @tap="goRoots">
            <text>去图谱继续</text>
          </view>
        </view>
      </view>

      <view v-else-if="currentWord && currentQuestion" class="question-card">
        <view class="question-card__top">
          <view class="question-card__pill">
            <text>{{ challengeLabel }}</text>
          </view>
          <text class="question-card__step">{{ headerMeta }}</text>
        </view>

        <text class="question-card__prompt">{{ currentQuestion.prompt }}</text>
        <text class="question-card__stem">{{ currentQuestion.stem }}</text>
        <text
          v-if="currentWord.phonetic && currentQuestion.type !== 'meaning_choice'"
          class="question-card__hint"
        >
          {{ currentWord.phonetic }}
        </text>

        <view class="progress-block">
          <view class="progress-block__row">
            <text class="progress-block__label">本轮节奏</text>
            <text class="progress-block__value">{{ sessionProgressLabel }}</text>
          </view>
          <view class="progress-track">
            <view class="progress-track__fill" :style="{ width: sessionProgressWidth }"></view>
          </view>
        </view>

        <view v-if="currentQuestion.type === 'meaning_choice'" class="choice-list">
          <view
            v-for="option in currentQuestion.options"
            :key="option.value"
            class="choice-item"
            :class="{ 'is-selected': selectedChoice === option.value }"
            @tap="selectChoice(option.value)"
          >
            <text>{{ option.label }}</text>
          </view>
        </view>

        <view v-else class="input-block">
          <view
            v-if="currentQuestion.type === 'listening_input'"
            class="audio-button"
            :class="{ 'is-playing': isPlayingAudio }"
            @tap="playCurrentAudio"
          >
            <text>{{ isPlayingAudio ? '播放中...' : '播放发音' }}</text>
          </view>
          <input
            class="answer-input"
            :value="inputAnswer"
            placeholder="输入英文单词"
            placeholder-class="answer-input__placeholder"
            confirm-type="done"
            @input="handleInput"
            @confirm="submitAnswer"
          />
        </view>

        <view class="question-card__footer">
          <view class="action-button action-button--primary" @tap="submitAnswer">
            <text>{{ submitButtonLabel }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import authService from '../../services/authService';
import themePage from '../../mixins/themePage';
import { getProgressSyncService, getWordRepo } from '../../services/lazyServices';

const CHALLENGE_TYPES = ['meaning_choice', 'spelling_input', 'listening_input'];
let progressSyncService = null;
let wordRepo = null;

function normalizeAnswer(input) {
  return String(input || '')
    .trim()
    .toLowerCase();
}

function shuffle(source, salt = '') {
  const list = Array.isArray(source) ? [...source] : [];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const saltCode = salt.charCodeAt(index % Math.max(1, salt.length)) || 17;
    const targetIndex = (saltCode + index * 7) % (index + 1);
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
  }
  return list;
}

function clampRatio(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export default {
  mixins: [themePage],
  data() {
    return {
      allWords: [],
      queue: [],
      currentWord: null,
      currentQuestion: null,
      selectedChoice: '',
      inputAnswer: '',
      exposureMap: {},
      isComplete: false,
      initialQueueSize: 0,
      solvedCount: 0,
      questionCursor: 0,
      isSubmitting: false,
      audioContext: null,
      isPlayingAudio: false,
    };
  },
  computed: {
    remainingCount() {
      return this.queue.length + (this.currentWord ? 1 : 0);
    },
    challengeLabel() {
      if (!this.currentQuestion) return '';
      if (this.currentQuestion.type === 'meaning_choice') return '识义选择';
      if (this.currentQuestion.type === 'spelling_input') return '拼写输入';
      return '听音识词';
    },
    headerMeta() {
      if (this.isComplete) {
        return `已解决 ${this.solvedCount} 个单词`;
      }
      return `已完成 ${this.solvedCount} · 剩余 ${this.remainingCount}`;
    },
    completionText() {
      if (!this.initialQueueSize) {
        return '先去 Roots 把想学的单词加入复习库，Tomorrow 才会长出新的任务。';
      }
      return '今天该回来的记忆都接住了，可以回图谱继续扩张词根主干。';
    },
    heroTitle() {
      if (this.isComplete) {
        return this.initialQueueSize ? '今天的回弹已经完成' : '今天先从新词根开始';
      }
      return '把今天该回来的记忆接住';
    },
    heroSubtitle() {
      if (this.isComplete) {
        return this.completionText;
      }
      return '只保留当前这一题，让复习节奏更轻、更稳，也更容易连续做下去。';
    },
    sessionProgressRatio() {
      if (!this.initialQueueSize) return this.isComplete ? 1 : 0;
      return clampRatio(this.solvedCount / this.initialQueueSize);
    },
    sessionProgressWidth() {
      return `${Math.round(this.sessionProgressRatio * 100)}%`;
    },
    sessionProgressLabel() {
      if (!this.initialQueueSize) return this.isComplete ? '已清空' : '0/0';
      return `${this.solvedCount}/${this.initialQueueSize}`;
    },
    submitButtonLabel() {
      if (this.isSubmitting) return '提交中...';
      return '提交答案';
    },
  },
  async onLoad() {
    await this.initializeSession();
  },
  onUnload() {
    this.destroyAudio();
  },
  methods: {
    async ensureLearningServices() {
      if (progressSyncService && wordRepo) return;
      const [loadedProgressSyncService, loadedWordRepo] = await Promise.all([
        getProgressSyncService(),
        getWordRepo(),
      ]);
      progressSyncService = loadedProgressSyncService;
      wordRepo = loadedWordRepo;
    },

    async initializeSession() {
      await this.ensureLearningServices();
      try {
        if (authService.isCloudLinked()) {
          await progressSyncService.hydrateProgressFromCloud();
        }
      } catch (error) {
        // fallback to local progress
      }

      this.allWords = await wordRepo.listAllWords({ withProgress: false });
      this.queue = (await wordRepo.getDueReviewQueue()).map((word) => word.id);
      this.initialQueueSize = this.queue.length;
      this.exposureMap = {};
      this.solvedCount = 0;
      this.questionCursor = 0;
      if (!this.queue.length) {
        this.isComplete = true;
        return;
      }
      await this.prepareNextQuestion();
    },
    async prepareNextQuestion() {
      await this.ensureLearningServices();
      this.destroyAudio();
      const nextWordId = this.queue.shift();
      if (!nextWordId) {
        this.currentWord = null;
        this.currentQuestion = null;
        this.isComplete = true;
        return;
      }

      const nextWord = await wordRepo.getWordById(nextWordId);
      if (!nextWord) {
        await this.prepareNextQuestion();
        return;
      }

      const exposureCount = Number(this.exposureMap[nextWordId] || 0) + 1;
      this.exposureMap = {
        ...this.exposureMap,
        [nextWordId]: exposureCount,
      };
      this.currentWord = nextWord;
      this.currentQuestion = this.buildQuestion(nextWord, this.questionCursor);
      this.selectedChoice = '';
      this.inputAnswer = '';
      this.questionCursor += 1;

      if (this.currentQuestion.type === 'listening_input') {
        this.$nextTick(() => {
          this.playCurrentAudio();
        });
      }
    },
    buildQuestion(word, cursor) {
      const requestedType = CHALLENGE_TYPES[cursor % CHALLENGE_TYPES.length];
      if (requestedType === 'meaning_choice') {
        return this.buildMeaningChoice(word);
      }
      if (requestedType === 'spelling_input') {
        return this.buildSpellingInput(word);
      }
      const listeningQuestion = this.buildListeningInput(word);
      return listeningQuestion || this.buildMeaningChoice(word);
    },
    buildMeaningChoice(word) {
      const distractors = shuffle(
        this.allWords.filter(
          (item) =>
            item.id !== word.id && item.translation && item.translation !== word.translation,
        ),
        word.id,
      )
        .slice(0, 3)
        .map((item) => ({
          value: item.id,
          label: item.translation,
        }));
      const options = shuffle(
        [{ value: word.id, label: word.translation || '暂无释义' }, ...distractors],
        word.word,
      );
      return {
        type: 'meaning_choice',
        prompt: '选出最贴近它的中文释义',
        stem: word.word,
        options,
        answer: word.id,
      };
    },
    buildSpellingInput(word) {
      return {
        type: 'spelling_input',
        prompt: '根据中文写出对应的英文单词',
        stem: word.translation || '请写出对应英文',
        answer: normalizeAnswer(word.canonical || word.word),
      };
    },
    buildListeningInput(word) {
      if (!wordRepo) return null;
      const audioUrl = wordRepo.getWordPronunciationUrl(word);
      if (!audioUrl) return null;
      return {
        type: 'listening_input',
        prompt: '听发音，写出你听到的单词',
        stem: '点击下方按钮播放发音',
        answer: normalizeAnswer(word.canonical || word.word),
        audioUrl,
      };
    },
    selectChoice(value) {
      this.selectedChoice = value;
    },
    handleInput(event) {
      this.inputAnswer = event && event.detail ? event.detail.value : '';
    },
    async submitAnswer() {
      await this.ensureLearningServices();
      if (!this.currentWord || !this.currentQuestion || this.isSubmitting) return;

      let correct = false;
      if (this.currentQuestion.type === 'meaning_choice') {
        correct = this.selectedChoice === this.currentQuestion.answer;
      } else {
        correct = normalizeAnswer(this.inputAnswer) === this.currentQuestion.answer;
      }

      this.isSubmitting = true;
      let submitted = false;
      try {
        await progressSyncService.submitReviewResultAndSync(this.currentWord.id, {
          challengeType: this.currentQuestion.type,
          correct,
          word: this.currentWord,
        });
        if (correct) {
          this.solvedCount += 1;
          uni.showToast({ title: '答对了', icon: 'success' });
        } else {
          if (Number(this.exposureMap[this.currentWord.id] || 0) < 2) {
            this.queue.push(this.currentWord.id);
          }
          uni.showToast({ title: '这题先回到队尾', icon: 'none' });
        }
        this.currentWord = await wordRepo.getWordById(this.currentWord.id);
        submitted = true;
      } catch (error) {
        uni.showToast({ title: error.message || '提交失败', icon: 'none' });
      } finally {
        this.isSubmitting = false;
      }

      if (submitted) {
        setTimeout(() => {
          this.prepareNextQuestion();
        }, 260);
      }
    },
    playCurrentAudio() {
      if (!this.currentQuestion || this.currentQuestion.type !== 'listening_input') return;
      this.destroyAudio();
      const audio = uni.createInnerAudioContext();
      this.audioContext = audio;
      this.isPlayingAudio = true;
      audio.src = this.currentQuestion.audioUrl;
      audio.onEnded(() => {
        this.isPlayingAudio = false;
        if (this.audioContext === audio) {
          this.audioContext = null;
        }
        audio.destroy();
      });
      audio.onError(() => {
        this.isPlayingAudio = false;
        if (this.audioContext === audio) {
          this.audioContext = null;
        }
        audio.destroy();
        this.currentQuestion = this.buildMeaningChoice(this.currentWord);
        this.selectedChoice = '';
        this.inputAnswer = '';
        uni.showToast({ title: '音频不可用，已切换识义题', icon: 'none' });
      });
      audio.play();
    },
    destroyAudio() {
      this.isPlayingAudio = false;
      if (!this.audioContext) return;
      try {
        this.audioContext.stop();
      } catch (error) {
        // ignore
      }
      try {
        this.audioContext.destroy();
      } catch (error) {
        // ignore
      }
      this.audioContext = null;
    },
    goToday() {
      uni.navigateBack({
        delta: 1,
        fail: () => {
          uni.switchTab({ url: '/pages/today/today' });
        },
      });
    },
    goRoots() {
      uni.switchTab({
        url: '/pages/roots/roots',
      });
    },
  },
};
</script>

<style lang="scss">
.practice-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 0%, rgba(255, 255, 255, 0.9), transparent 26%),
    radial-gradient(circle at 88% 10%, rgba(229, 234, 239, 0.46), transparent 22%),
    linear-gradient(180deg, #f4f6f8 0%, #eef1f4 42%, #f8f9fb 100%);
  color: #1f2933;
}

.practice-shell {
  min-height: 100vh;
  padding: 104rpx 28rpx 40rpx;
  box-sizing: border-box;
}

.practice-topbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 16rpx;
}

.practice-home-btn {
  min-height: 64rpx;
  border-radius: 18rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 16rpx 42rpx rgba(15, 23, 42, 0.04);
  font-size: 22rpx;
  font-weight: 700;
  color: #1f2933;
}

.practice-hero {
  margin-bottom: 26rpx;
}

.practice-hero__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.practice-hero__intro {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}

.practice-hero__eyebrow {
  font-size: 18rpx;
  letter-spacing: 5rpx;
  color: rgba(30, 36, 48, 0.42);
}

.practice-hero__title {
  font-size: 62rpx;
  line-height: 1.06;
  font-weight: 700;
  letter-spacing: -1.4rpx;
}

.practice-hero__subtitle {
  max-width: 560rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(30, 36, 48, 0.68);
}

.practice-hero__badge {
  min-width: 150rpx;
  padding: 18rpx 18rpx 16rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 20rpx 48rpx rgba(15, 23, 42, 0.05);
  text-align: center;
}

.practice-hero__badge-value {
  display: block;
  font-size: 38rpx;
  line-height: 1;
  font-weight: 700;
  color: var(--rf-accent);
}

.practice-hero__badge-label {
  display: block;
  margin-top: 8rpx;
  font-size: 16rpx;
  letter-spacing: 2rpx;
  color: rgba(30, 36, 48, 0.5);
}

.practice-summary {
  display: flex;
  gap: 14rpx;
  margin-top: 24rpx;
}

.practice-summary__item,
.state-stat {
  flex: 1;
  min-width: 0;
  padding: 20rpx 18rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.56);
  box-shadow: 0 18rpx 52rpx rgba(15, 23, 42, 0.045);
}

.practice-summary__value,
.state-stat__value {
  display: block;
  font-size: 34rpx;
  line-height: 1.1;
  font-weight: 700;
  color: #1f2933;
}

.practice-summary__label,
.state-stat__label {
  display: block;
  margin-top: 10rpx;
  font-size: 20rpx;
  color: rgba(30, 36, 48, 0.58);
}

.state-card,
.question-card {
  border-radius: 38rpx;
  padding: 32rpx;
  box-sizing: border-box;
}

.state-card {
  background: rgba(255, 255, 255, 0.56);
  box-shadow: 0 20rpx 60rpx rgba(15, 23, 42, 0.05);
}

.state-card__eyebrow {
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: rgba(30, 36, 48, 0.42);
}

.state-card__title {
  display: block;
  margin-top: 14rpx;
  font-size: 42rpx;
  line-height: 1.2;
  font-weight: 700;
  color: #1f2933;
}

.state-card__desc {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(30, 36, 48, 0.68);
}

.state-card__stats {
  display: flex;
  gap: 14rpx;
  margin-top: 24rpx;
}

.state-card__actions,
.question-card__footer {
  display: flex;
  gap: 14rpx;
  margin-top: 28rpx;
}

.question-card {
  overflow: hidden;
  background: var(--rf-focus-bg);
  box-shadow: 0 28rpx 72rpx rgba(15, 23, 42, 0.06);
  color: var(--rf-focus-text);
}

.question-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.question-card__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10rpx 16rpx;
  border-radius: 18rpx;
  background: var(--rf-focus-surface);
  font-size: 18rpx;
  color: var(--rf-focus-muted);
}

.question-card__step {
  font-size: 20rpx;
  color: var(--rf-focus-muted);
}

.question-card__prompt {
  display: block;
  margin-top: 24rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--rf-focus-muted);
}

.question-card__stem {
  display: block;
  margin-top: 18rpx;
  font-size: 50rpx;
  line-height: 1.18;
  font-weight: 700;
}

.question-card__hint {
  display: block;
  margin-top: 14rpx;
  font-size: 22rpx;
  color: var(--rf-focus-kicker);
}

.progress-block {
  margin-top: 26rpx;
}

.progress-block__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.progress-block__label,
.progress-block__value {
  font-size: 22rpx;
  color: var(--rf-focus-muted);
}

.progress-track {
  overflow: hidden;
  height: 14rpx;
  margin-top: 14rpx;
  border-radius: 999rpx;
  background: var(--rf-progress-track);
}

.progress-track__fill {
  height: 100%;
  min-width: 14rpx;
  border-radius: inherit;
  background: var(--rf-progress-fill);
}

.choice-list,
.input-block {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 24rpx;
}

.choice-item,
.audio-button,
.answer-input,
.action-button {
  min-height: 88rpx;
  border-radius: 24rpx;
  box-sizing: border-box;
}

.choice-item,
.audio-button,
.answer-input {
  border: 1rpx solid var(--rf-input-border);
  background: var(--rf-input-bg);
  color: var(--rf-input-text);
}

.choice-item,
.audio-button,
.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
}

.choice-item {
  justify-content: flex-start;
  padding: 0 22rpx;
  font-size: 24rpx;
}

.choice-item.is-selected {
  background: rgba(255, 255, 255, 0.66);
  border-color: rgba(31, 41, 51, 0.1);
}

.audio-button.is-playing {
  border-color: rgba(31, 41, 51, 0.1);
  color: var(--rf-accent-strong);
}

.answer-input {
  width: 100%;
  padding: 0 24rpx;
}

.answer-input__placeholder {
  color: var(--rf-placeholder);
}

.action-button {
  flex: 1;
  padding: 0 24rpx;
  font-size: 26rpx;
  font-weight: 700;
}

.action-button--primary {
  background: var(--rf-button-primary-bg);
  color: var(--rf-button-primary-text);
}

.action-button--secondary {
  background: var(--rf-button-secondary-bg);
  color: var(--rf-button-secondary-text);
}

.practice-page.theme-dark-zen {
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
}

.theme-dark-zen .practice-hero__eyebrow,
.theme-dark-zen .state-card__eyebrow {
  color: var(--rf-text-kicker);
}

.theme-dark-zen .practice-hero__subtitle,
.theme-dark-zen .state-card__desc {
  color: var(--rf-text-muted);
}

.theme-dark-zen .practice-hero__badge,
.theme-dark-zen .practice-home-btn,
.theme-dark-zen .practice-summary__item,
.theme-dark-zen .state-stat,
.theme-dark-zen .state-card {
  background: var(--rf-surface);
  box-shadow: var(--rf-card-shadow);
}

.theme-dark-zen .practice-hero__badge-value {
  color: #ffd7a8;
}

.theme-dark-zen .practice-hero__badge-label,
.theme-dark-zen .practice-summary__label,
.theme-dark-zen .state-stat__label {
  color: var(--rf-text-soft);
}

.theme-dark-zen .practice-summary__value,
.theme-dark-zen .state-stat__value,
.theme-dark-zen .state-card__title {
  color: var(--rf-text-strong);
}

.theme-dark-zen .action-button--secondary {
  background: var(--rf-button-secondary-bg);
  color: var(--rf-button-secondary-text);
}
</style>
