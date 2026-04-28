<template>
  <view class="learning-page" :class="currentTheme">
    <theme-toggle-fab :theme="currentTheme" />
    <view class="learning-shell">
      <view class="learning-topbar">
        <view class="topbar-back-btn" @tap="goBackToToday">
          <text>返回主页</text>
        </view>
      </view>

      <view class="summary-card" :class="{ 'is-collapsed': isSummaryCollapsed }">
        <view class="summary-card__topbar">
          <view class="summary-card__heading">
            <text class="summary-card__title">词根学习流</text>
            <text v-if="summarySubtitleText" class="summary-card__subtitle">{{
              summarySubtitleText
            }}</text>
          </view>

          <view class="summary-card__toggle" @tap="toggleSummaryCard">
            <text class="summary-card__toggle-text">
              {{ isSummaryCollapsed ? '展开卡片' : '收起卡片' }}
            </text>
          </view>
        </view>

        <view v-if="!isSummaryCollapsed" class="summary-card__body">
          <view class="alphabet-panel">
            <view class="alphabet-panel__header">
              <text class="alphabet-panel__title">字母索引</text>
              <text class="alphabet-panel__current">{{ selectedLetter.toUpperCase() }} 开头</text>
            </view>

            <view class="alphabet-grid">
              <view
                v-for="letter in alphabetOptions"
                :key="letter"
                class="alphabet-key"
                :class="{
                  'is-active': selectedLetter === letter,
                  'is-disabled': !hasLetterRoots(letter),
                }"
                @tap="selectLetter(letter)"
              >
                <text>{{ letter.toUpperCase() }}</text>
              </view>
            </view>
          </view>
          <text class="alphabet-panel__meta">{{ letterMetaText }}</text>

          <view v-if="showRootOverview" class="summary-card__divider"></view>

          <view v-if="showRootOverview" class="root-overview">
            <view class="root-overview__header">
              <view class="root-overview__heading">
                <text class="root-overview__eyebrow">CURRENT ROOT</text>
                <text class="root-overview__title">{{ currentRootLabel }}</text>
              </view>
              <text class="root-overview__flag"
                >{{ currentPageNumber }}/{{ pageRoots.length }}</text
              >
            </view>

            <text v-if="currentRootMeaning" class="root-overview__meaning">{{
              currentRootMeaning
            }}</text>
            <text v-if="currentRootDescription" class="root-overview__desc">
              {{ currentRootDescription }}
            </text>

            <view class="focus-metrics">
              <view class="focus-metric">
                <text class="focus-metric__value">{{ remainingCount }}</text>
                <text class="focus-metric__label">待学</text>
              </view>
              <view class="focus-metric">
                <text class="focus-metric__value">{{ memorizedCount }}</text>
                <text class="focus-metric__label">已背</text>
              </view>
              <view class="focus-metric">
                <text class="focus-metric__value">{{ totalWordsInPage }}</text>
                <text class="focus-metric__label">总词数</text>
              </view>
            </view>

            <view class="progress-block">
              <view class="progress-block__row">
                <text class="progress-block__label">当前词根进度</text>
                <text class="progress-block__value">{{ rootProgress }}</text>
              </view>
              <view class="progress-track">
                <view
                  class="progress-track__fill"
                  :style="{ width: currentRootProgressPercent }"
                ></view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="!isLoading && !pageRoots.length" class="state-card">
        <text class="state-card__eyebrow">EMPTY LETTER</text>
        <text class="state-card__title">该字母下暂无可学习词根</text>
        <text class="state-card__desc">切换字母后继续学习。</text>
      </view>

      <view v-else-if="isAllComplete && !isLoading" class="state-card">
        <text class="state-card__eyebrow">ALL ROOTS COMPLETE</text>
        <text class="state-card__title">全部一级词根都学完了</text>
        <text class="state-card__desc">{{ totalMemorized }} 个单词已完成滑动记忆。</text>

        <view class="state-card__stats">
          <view class="state-stat">
            <text class="state-stat__value">{{ completedRootsCount }}</text>
            <text class="state-stat__label">完成词根</text>
          </view>
          <view class="state-stat">
            <text class="state-stat__value">{{ totalMemorized }}</text>
            <text class="state-stat__label">累计已背</text>
          </view>
        </view>

        <view class="state-card__actions">
          <view class="action-button action-button--primary" @tap="resetSession">
            <text>重新开始</text>
          </view>
          <view class="action-button action-button--secondary" @tap="goBackToToday">
            <text>返回主页</text>
          </view>
        </view>
      </view>

      <view v-else-if="showBlockingLoading" class="loading-card">
        <text class="loading-card__eyebrow">LOADING ROOT</text>
        <text class="loading-card__title">正在整理当前词根的学习流</text>
        <text class="loading-card__desc">把词根、单词和衍生分支按树序排好，马上就能开始继续。</text>
      </view>

      <template v-else>
        <view class="section-card">
          <view v-if="showTransitionMask" class="section-card__status">
            <text>正在切换词根…</text>
          </view>

          <view v-if="!learningItems.length" class="inline-empty">
            <text class="inline-empty__title">这个一级词根已经学完</text>
            <text class="inline-empty__desc">继续进入下一个一级词根，让学习流保持连贯。</text>
            <view class="action-button action-button--primary" @tap="nextRoot">
              <text>下一个词根</text>
            </view>
          </view>

          <view v-else class="learning-flow">
            <view
              v-for="item in learningItems"
              :key="item.key"
              class="learning-item"
              :class="getLearningItemClass(item)"
              :style="getLearningItemIndent(item)"
            >
              <template v-if="item.type === 'section'">
                <view class="section-row">
                  <view class="section-row__eyebrow">
                    <text>{{ getSectionKindLabel(item.kind) }}</text>
                    <text>{{ item.visibleWordCount }} 词</text>
                  </view>
                  <text class="section-row__title">{{ item.title }}</text>
                  <text v-if="item.subtitle" class="section-row__subtitle">{{
                    item.subtitle
                  }}</text>
                </view>
              </template>

              <template v-else>
                <view
                  class="word-row"
                  :class="{
                    'is-pending': pendingWordId === item.wordId,
                    'is-mastered': item.isMemorized,
                  }"
                  @tap="handleWordCardTap(item)"
                >
                  <view class="word-row__content">
                    <view class="word-row__main">
                      <view class="word-row__header">
                        <text class="word-row__word">{{ item.word }}</text>
                        <view
                          class="word-row__mastered"
                          :class="{
                            'is-visible': item.isMemorized || pendingWordId === item.wordId,
                          }"
                        >
                          <text>✓</text>
                        </view>
                        <view
                          class="word-row__favorite"
                          :class="{ 'is-active': isWordFavorited(item.wordId) }"
                          @tap.stop="toggleWordFavorite(item)"
                        >
                          <text>{{ isWordFavorited(item.wordId) ? '已收藏' : '收藏' }}</text>
                        </view>
                      </view>
                      <text class="word-row__translation">{{ item.translation }}</text>
                    </view>
                  </view>
                </view>
              </template>
            </view>
          </view>

          <view v-if="remainingCount === 0 && learningItems.length" class="completion-card">
            <text class="completion-card__title">当前一级词根已全部标记完成</text>
            <text class="completion-card__desc"
              >这些单词会保留在列表中，你可以继续复看后再进入下一个词根。</text
            >
            <view class="action-button action-button--primary" @tap="nextRoot">
              <text>下一个词根</text>
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script>
import themePage from '../../mixins/themePage';
import progressSyncService from '../../services/progressSyncService';
import wordRepo from '../../services/wordRepo';

const STORAGE_KEY = 'learningProgress';
const WORD_STATUS_NEW = 'new';
const LETTER_OPTIONS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const LETTER_STORAGE_KEY = 'rf_learning_letter_v1';
const FAVORITE_WORD_STORAGE_KEY = 'rf_learning_favorite_words_v1';
const SUMMARY_COLLAPSE_STORAGE_KEY = 'rf_learning_summary_collapsed_v1';

function sortBySourceIndex(left, right) {
  return (
    Number(left.sourceIndex || Number.MAX_SAFE_INTEGER) -
    Number(right.sourceIndex || Number.MAX_SAFE_INTEGER)
  );
}

function getCompletedRootsFromStorage() {
  const savedProgress = uni.getStorageSync(STORAGE_KEY) || {};
  return new Set(savedProgress.completedRoots || []);
}

function normalizeLetter(input) {
  const letter = String(input || '')
    .trim()
    .toLowerCase()
    .slice(0, 1);
  return LETTER_OPTIONS.includes(letter) ? letter : '';
}

function pickRootLetter(root) {
  return normalizeLetter(root && (root.rootId || root.root || ''));
}

function readFavoriteWordLookup() {
  const saved = uni.getStorageSync(FAVORITE_WORD_STORAGE_KEY);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    return {};
  }
  return { ...saved };
}

export default {
  mixins: [themePage],
  data() {
    return {
      allPageRoots: [],
      pageRoots: [],
      alphabetOptions: LETTER_OPTIONS,
      selectedLetter: 'a',
      isSummaryCollapsed: false,
      favoriteWordLookup: {},
      globalLearnedWordIds: new Set(),
      currentRootIndex: 0,
      currentRootId: '',
      currentRootLabel: '',
      currentRootMeaning: '',
      currentRootDescription: '',

      currentRootSnapshot: null,
      learningItems: [],
      totalWordsInPage: 0,
      memorizedWordIds: new Set(),
      memorizedCountValue: 0,
      totalMemorized: 0,
      completedRootsCount: 0,
      isAllComplete: false,
      isLoading: false,
      isRootTransitioning: false,
      pendingWordId: '',
      saveProgressTimer: null,
    };
  },

  computed: {
    showRootOverview() {
      return Boolean(
        !this.isAllComplete &&
        this.pageRoots.length &&
        this.currentRootLabel &&
        this.currentRootSnapshot,
      );
    },

    showBlockingLoading() {
      return Boolean(this.isLoading && !this.currentRootSnapshot && !this.learningItems.length);
    },

    showTransitionMask() {
      return Boolean(
        this.isRootTransitioning && this.currentRootSnapshot && this.learningItems.length,
      );
    },

    memorizedCount() {
      return this.memorizedCountValue;
    },

    remainingCount() {
      return Math.max(this.totalWordsInPage - this.memorizedCount, 0);
    },

    rootProgress() {
      return `${this.memorizedCount}/${this.totalWordsInPage || 0} 已背`;
    },

    currentRootProgressPercent() {
      if (!this.totalWordsInPage) return '0%';
      const percent = (this.memorizedCount / this.totalWordsInPage) * 100;
      return `${Math.min(percent, 100)}%`;
    },

    currentRootStatsText() {
      return `${this.remainingCount} 个待学 · ${this.totalWordsInPage} 个总词`;
    },

    currentPageNumber() {
      if (!this.pageRoots.length) return 0;
      return this.currentRootIndex + 1;
    },

    letterMetaText() {
      if (!this.pageRoots.length) {
        return `${this.selectedLetter.toUpperCase()} 开头暂无可学习词根`;
      }
      return `${this.pageRoots.length} 组一级词根`;
    },

    summarySubtitleText() {
      if (!this.isSummaryCollapsed) return '';

      if (this.isLoading) {
        return `${this.selectedLetter.toUpperCase()} 开头，正在整理学习流`;
      }

      if (!this.pageRoots.length) {
        return `${this.selectedLetter.toUpperCase()} 开头暂无可学习词根`;
      }

      if (this.isAllComplete) {
        return `${this.selectedLetter.toUpperCase()} 开头已全部完成`;
      }

      return `${this.selectedLetter.toUpperCase()} 开头 · ${this.currentRootLabel || '当前词根'} · ${this.rootProgress}`;
    },
  },

  onLoad() {
    this.learningSnapshotCache = Object.create(null);
    this.favoriteWordLookup = readFavoriteWordLookup();
    this.selectedLetter = normalizeLetter(uni.getStorageSync(LETTER_STORAGE_KEY)) || 'a';
    this.isSummaryCollapsed = Boolean(uni.getStorageSync(SUMMARY_COLLAPSE_STORAGE_KEY));
    this.initializeSession();
  },

  onHide() {
    this.flushPendingLocalProgress();
    this.flushPendingSync('learning-page-hide');
  },

  onUnload() {
    this.flushPendingLocalProgress();
    this.flushPendingSync('learning-page-unload');
  },

  methods: {
    async ensureLearningServices() {
      return true;
    },

    persistLearningProgress(completedRoots = getCompletedRootsFromStorage()) {
      uni.setStorageSync(STORAGE_KEY, {
        completedRoots: Array.from(completedRoots),
        totalMemorized: this.getActualTotalMemorized(),
      });
    },

    flushPendingSync(reason = 'learning-page') {
      return progressSyncService.flushPendingProgressSync({ reason }).catch((error) => {
        console.error(`Failed to flush pending progress sync: ${reason}`, error);
        return null;
      });
    },

    readGlobalLearnedWordIds() {
      const progressMap = wordRepo.getProgressMapSnapshot();
      return new Set(
        Object.keys(progressMap).filter((wordId) => {
          const progress = progressMap[wordId];
          return progress && String(progress.status || WORD_STATUS_NEW) !== WORD_STATUS_NEW;
        }),
      );
    },

    refreshGlobalLearnedWordIds() {
      this.globalLearnedWordIds = this.readGlobalLearnedWordIds();
      this.totalMemorized = this.globalLearnedWordIds.size;
      return new Set(this.globalLearnedWordIds);
    },

    getGlobalLearnedWordIds() {
      return new Set(this.globalLearnedWordIds);
    },

    getActualTotalMemorized() {
      return this.globalLearnedWordIds.size;
    },

    getCompletedRootsForCurrentState(baseCompletedRoots = getCompletedRootsFromStorage()) {
      const completedRoots = new Set(baseCompletedRoots);

      if (this.currentRootId) {
        if (this.remainingCount === 0 && this.totalWordsInPage > 0) {
          completedRoots.add(this.currentRootId);
        } else {
          completedRoots.delete(this.currentRootId);
        }
      }

      return completedRoots;
    },

    refreshCompletedRootsCount(completedRoots) {
      this.completedRootsCount = this.pageRoots.filter((root) =>
        completedRoots.has(root.rootId),
      ).length;
    },

    syncCompletedStateFromCurrentRoot() {
      const completedRoots = this.getCompletedRootsForCurrentState();
      this.refreshCompletedRootsCount(completedRoots);
    },

    scheduleSaveProgress() {
      if (this.saveProgressTimer) {
        clearTimeout(this.saveProgressTimer);
      }

      this.saveProgressTimer = setTimeout(() => {
        this.saveProgressTimer = null;
        this.saveProgress();
      }, 120);
    },

    flushPendingLocalProgress() {
      if (!this.saveProgressTimer) return;
      clearTimeout(this.saveProgressTimer);
      this.saveProgressTimer = null;
      this.saveProgress();
    },

    getPreferredLetter() {
      if (this.hasLetterRoots(this.selectedLetter)) return this.selectedLetter;
      const firstAvailable = this.alphabetOptions.find((letter) => this.hasLetterRoots(letter));
      return firstAvailable || 'a';
    },

    hasLetterRoots(letter) {
      const normalizedLetter = normalizeLetter(letter);
      if (!normalizedLetter) return false;
      return this.allPageRoots.some((root) => pickRootLetter(root) === normalizedLetter);
    },

    isWordFavorited(wordId) {
      return Boolean(this.favoriteWordLookup[wordId]);
    },

    isWordMemorized(wordId) {
      return this.memorizedWordIds.has(wordId);
    },

    persistFavoriteWords() {
      uni.setStorageSync(FAVORITE_WORD_STORAGE_KEY, this.favoriteWordLookup);
    },

    toggleWordFavorite(item) {
      if (!item || !item.wordId) return;
      const wordId = item.wordId;
      const nextLookup = { ...this.favoriteWordLookup };

      if (nextLookup[wordId]) {
        delete nextLookup[wordId];
      } else {
        nextLookup[wordId] = {
          wordId,
          word: item.word,
          translation: item.translation,
          updatedAt: Date.now(),
        };
      }

      this.favoriteWordLookup = nextLookup;
      this.persistFavoriteWords();
    },

    toggleSummaryCard() {
      this.isSummaryCollapsed = !this.isSummaryCollapsed;
      uni.setStorageSync(SUMMARY_COLLAPSE_STORAGE_KEY, this.isSummaryCollapsed);
    },

    async selectLetter(letter) {
      await this.ensureLearningServices();
      const normalizedLetter = normalizeLetter(letter);
      if (!normalizedLetter || normalizedLetter === this.selectedLetter) return;

      this.flushPendingLocalProgress();
      this.selectedLetter = normalizedLetter;
      uni.setStorageSync(LETTER_STORAGE_KEY, normalizedLetter);
      await this.flushPendingSync('learning-select-letter');
      await this.applyLetterFilter();
    },

    async applyLetterFilter() {
      await this.ensureLearningServices();
      this.refreshGlobalLearnedWordIds();
      const completedRoots = getCompletedRootsFromStorage();
      this.pageRoots = this.allPageRoots.filter(
        (root) => pickRootLetter(root) === this.selectedLetter,
      );
      this.completedRootsCount = this.pageRoots.filter((root) =>
        completedRoots.has(root.rootId),
      ).length;

      this.currentRootIndex = 0;
      this.currentRootId = '';
      this.currentRootLabel = '';
      this.currentRootMeaning = '';
      this.currentRootDescription = '';
      this.currentRootSnapshot = null;
      this.learningItems = [];
      this.totalWordsInPage = 0;
      this.memorizedWordIds = new Set();
      this.memorizedCountValue = 0;
      this.resetInteractionState();

      if (!this.pageRoots.length) {
        this.isAllComplete = false;
        return;
      }

      const firstIncompleteIndex = this.pageRoots.findIndex(
        (root) => !completedRoots.has(root.rootId),
      );
      if (firstIncompleteIndex === -1) {
        this.isAllComplete = true;
        return;
      }

      this.isAllComplete = false;
      this.currentRootIndex = firstIncompleteIndex;
      await this.loadCurrentRootPage();
    },

    async initializeSession() {
      this.isLoading = true;

      try {
        await this.ensureLearningServices();
        const { roots, hydrationIssue } = await progressSyncService.initializeLearningSessionData();
        this.refreshGlobalLearnedWordIds();

        if (hydrationIssue) {
          console.warn(
            'Learning session cloud hydration was unavailable. Falling back to local progress.',
            hydrationIssue,
          );
          uni.showToast({
            title: '云端同步暂不可用',
            icon: 'none',
          });
        }

        this.allPageRoots = roots
          .filter((root) => Number(root.rootLevel || 0) === 1)
          .filter((root) => Number(root.descendantWordCount || root.wordCount || 0) > 0)
          .sort(sortBySourceIndex);
        this.selectedLetter = this.getPreferredLetter();
        uni.setStorageSync(LETTER_STORAGE_KEY, this.selectedLetter);
        await this.applyLetterFilter();
      } catch (error) {
        console.error('Failed to initialize learning session data:', error);
        uni.showToast({ title: '加载失败', icon: 'error' });
      } finally {
        this.isLoading = false;
      }
    },

    async loadCurrentRootPage() {
      await this.ensureLearningServices();
      this.isLoading = true;
      this.isRootTransitioning = Boolean(this.currentRootSnapshot || this.learningItems.length);
      this.resetInteractionState();

      try {
        const currentRoot = this.pageRoots[this.currentRootIndex];
        if (!currentRoot) {
          this.learningItems = [];
          return;
        }

        const learnedWordIds = this.getGlobalLearnedWordIds();
        const snapshot = await this.getLearningSnapshot(currentRoot.rootId);
        const nextState = this.buildLearningStateFromSnapshot(snapshot, learnedWordIds);

        this.currentRootId = currentRoot.rootId;
        this.currentRootLabel = currentRoot.root || currentRoot.rootId;
        this.currentRootMeaning = String(currentRoot.meaning || '').trim();
        this.currentRootDescription = String(currentRoot.descriptionCn || '').trim();
        this.currentRootSnapshot = snapshot;
        this.learningItems = nextState.learningItems;
        this.memorizedWordIds = nextState.memorizedWordIds;
        this.memorizedCountValue = nextState.memorizedCount;
        this.totalWordsInPage = nextState.totalWords;
        this.totalMemorized = learnedWordIds.size;
        wordRepo.setLastLearningRoot(currentRoot.rootId);
        this.syncCompletedStateFromCurrentRoot();
        this.prefetchNextRootSnapshot();
      } catch (error) {
        console.error('Failed to load current root page:', error);
        uni.showToast({ title: '词根加载失败', icon: 'error' });
      } finally {
        this.isLoading = false;
        this.isRootTransitioning = false;
      }
    },

    async getLearningSnapshot(rootId) {
      await this.ensureLearningServices();
      const normalizedRootId = String(rootId || '')
        .trim()
        .toLowerCase();
      if (!normalizedRootId) return null;

      if (!this.learningSnapshotCache) {
        this.learningSnapshotCache = Object.create(null);
      }
      if (this.learningSnapshotCache[normalizedRootId]) {
        return this.learningSnapshotCache[normalizedRootId];
      }

      const snapshot = await wordRepo.getLearningRootSnapshot(normalizedRootId, {
        withProgress: false,
      });
      this.learningSnapshotCache[normalizedRootId] = snapshot;
      return snapshot;
    },

    applyLearningSnapshot(snapshot) {
      const learnedWordIds = this.getGlobalLearnedWordIds();
      const state = this.buildLearningStateFromSnapshot(snapshot, learnedWordIds);
      this.learningItems = state.learningItems;
      this.memorizedWordIds = state.memorizedWordIds;
      this.memorizedCountValue = state.memorizedCount;
      this.totalWordsInPage = state.totalWords;
    },

    waitForWordStatePaint() {
      return this.$nextTick().then(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 0);
          }),
      );
    },

    prefetchNextRootSnapshot() {
      const nextRoot = this.pageRoots[this.currentRootIndex + 1];
      if (!nextRoot || !nextRoot.rootId) return;
      this.getLearningSnapshot(nextRoot.rootId).catch(() => null);
    },

    buildLearningStateFromSnapshot(snapshot, learnedWordIds) {
      if (!snapshot) {
        return {
          learningItems: [],
          memorizedWordIds: new Set(),
          memorizedCount: 0,
          totalWords: 0,
        };
      }

      const memorizedWordIds = new Set();
      const items = [];
      const rootWords = Array.isArray(snapshot.words) ? snapshot.words : [];
      rootWords.forEach((word) => {
        const isMemorized = learnedWordIds.has(word.id);
        if (isMemorized) {
          memorizedWordIds.add(word.id);
        }
        items.push(this.createWordItem(word, 0, [], isMemorized));
      });

      (snapshot.children || []).forEach((child) => {
        const result = this.flattenLearningSnapshotNode(
          child,
          1,
          learnedWordIds,
          memorizedWordIds,
          [],
        );
        if (result.items.length) {
          items.push(...result.items);
        }
      });

      return {
        learningItems: items,
        memorizedWordIds,
        memorizedCount: memorizedWordIds.size,
        totalWords: Number(snapshot.totalWords || 0),
      };
    },

    flattenLearningSnapshotNode(node, depth, learnedWordIds, memorizedWordIds, parentSectionKeys) {
      const sectionKey = this.getSectionItemKey(node.root.rootId);
      const nextSectionKeys = parentSectionKeys.concat(sectionKey);
      const bodyItems = [];
      let visibleWordCount = 0;

      (node.words || []).forEach((word) => {
        const isMemorized = learnedWordIds.has(word.id);
        if (isMemorized) {
          memorizedWordIds.add(word.id);
        }
        visibleWordCount += 1;
        bodyItems.push(this.createWordItem(word, depth, nextSectionKeys, isMemorized));
      });

      (node.children || []).forEach((child) => {
        const result = this.flattenLearningSnapshotNode(
          child,
          depth + 1,
          learnedWordIds,
          memorizedWordIds,
          nextSectionKeys,
        );
        if (!result.visibleWordCount) return;
        visibleWordCount += result.visibleWordCount;
        bodyItems.push(...result.items);
      });

      if (!visibleWordCount) {
        return { items: [], visibleWordCount: 0 };
      }

      const items = [
        {
          type: 'section',
          key: sectionKey,
          depth,
          kind: node.root.type || 'root',
          title: node.root.root || node.root.rootId,
          subtitle: String(node.root.meaning || node.root.descriptionCn || '').trim(),
          visibleWordCount,
        },
        ...bodyItems,
      ];

      return { items, visibleWordCount };
    },

    getSectionItemKey(rootId) {
      return `section:${rootId}`;
    },

    createWordItem(word, depth, sectionKeys = [], isMemorized = false) {
      return {
        type: 'word',
        key: `word:${word.id}`,
        wordId: word.id,
        rawWord: word,
        word: word.display || word.word || word.id,
        translation: String(word.translation || '').trim() || '暂无释义',
        depth,
        sectionKeys,
        isMemorized,
      };
    },

    getSectionKindLabel(kind) {
      if (kind === 'branch') return '衍生分支';
      if (kind === 'word-family') return '衍生词族';
      if (kind === 'section') return '分组';
      return '词根';
    },

    getLearningItemClass(item) {
      return item.type === 'section' ? 'learning-item--section' : 'learning-item--word';
    },

    getLearningItemIndent(item) {
      const leftPadding = 18 + item.depth * 18;
      return {
        paddingLeft: `${leftPadding}rpx`,
      };
    },

    async handleWordCardTap(item) {
      if (!item || item.type !== 'word' || !item.wordId) return;
      if (item.isMemorized) return;
      if (this.pendingWordId === item.wordId) return;
      this.markWordMemorized(item.wordId);
    },

    async markWordMemorized(wordId) {
      await this.ensureLearningServices();
      const activeItem = this.learningItems.find((item) => item.wordId === wordId);
      if (!activeItem) return;
      this.pendingWordId = wordId;

      const nextIds = new Set(this.memorizedWordIds);
      nextIds.add(wordId);
      this.memorizedWordIds = nextIds;
      this.memorizedCountValue = nextIds.size;
      const nextGlobalIds = new Set(this.globalLearnedWordIds);
      nextGlobalIds.add(wordId);
      this.globalLearnedWordIds = nextGlobalIds;
      this.totalMemorized = nextGlobalIds.size;
      const activeIndex = this.learningItems.findIndex((item) => item.wordId === wordId);
      if (activeIndex !== -1) {
        const nextItem = {
          ...this.learningItems[activeIndex],
          isMemorized: true,
        };
        this.learningItems.splice(activeIndex, 1, nextItem);
      }
      this.syncCompletedStateFromCurrentRoot();
      this.scheduleSaveProgress();
      await this.waitForWordStatePaint();

      try {
        await progressSyncService.enqueueWordForReviewAndSync(wordId, {
          word: activeItem.rawWord,
        });
      } catch (error) {
        this.refreshGlobalLearnedWordIds();
        uni.showToast({
          title: error.message || '已加入复习，本次云同步稍后再试',
          icon: 'none',
        });
      } finally {
        if (this.pendingWordId === wordId) {
          this.pendingWordId = '';
        }
      }
    },

    resetInteractionState() {
      this.pendingWordId = '';
    },

    async completeCurrentRoot() {
      this.flushPendingLocalProgress();
      await this.flushPendingSync('learning-complete-root');
      const completedRoots = getCompletedRootsFromStorage();
      completedRoots.add(this.currentRootId);

      this.refreshCompletedRootsCount(completedRoots);
      this.persistLearningProgress(completedRoots);

      if (this.currentRootIndex + 1 < this.pageRoots.length) {
        this.currentRootIndex += 1;
        await this.loadCurrentRootPage();
        return;
      }

      this.isAllComplete = true;
    },

    async nextRoot() {
      this.flushPendingLocalProgress();
      await this.flushPendingSync('learning-next-root');
      if (this.currentRootIndex + 1 < this.pageRoots.length) {
        this.currentRootIndex += 1;
        await this.loadCurrentRootPage();
        return;
      }

      this.isAllComplete = true;
    },

    saveProgress() {
      const completedRoots = this.getCompletedRootsForCurrentState();
      this.refreshCompletedRootsCount(completedRoots);
      this.persistLearningProgress(completedRoots);
    },

    resetSession() {
      if (this.saveProgressTimer) {
        clearTimeout(this.saveProgressTimer);
        this.saveProgressTimer = null;
      }
      uni.removeStorageSync(STORAGE_KEY);
      this.currentRootIndex = 0;
      this.currentRootId = '';
      this.currentRootLabel = '';
      this.currentRootMeaning = '';
      this.currentRootDescription = '';
      this.currentRootSnapshot = null;
      this.learningItems = [];
      this.totalWordsInPage = 0;
      this.memorizedWordIds = new Set();
      this.memorizedCountValue = 0;
      this.totalMemorized = 0;
      this.completedRootsCount = 0;
      this.isAllComplete = false;
      this.isRootTransitioning = false;
      this.resetInteractionState();
      this.initializeSession();
    },

    goBackToToday() {
      uni.switchTab({ url: '/pages/today/today' });
    },

    goBack() {
      this.goBackToToday();
    },
  },
};
</script>

<style lang="scss" scoped>
.learning-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 0%, rgba(255, 255, 255, 0.9), transparent 26%),
    radial-gradient(circle at 88% 10%, rgba(229, 234, 239, 0.46), transparent 22%),
    linear-gradient(180deg, #f4f6f8 0%, #eef1f4 42%, #f8f9fb 100%);
  color: #1f2933;
}

.learning-shell {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 128rpx) 28rpx 36rpx;
  box-sizing: border-box;
}

.learning-topbar {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 16rpx);
  left: 24rpx;
  z-index: 110;
  pointer-events: none;
}

.topbar-back-btn {
  min-height: 64rpx;
  border-radius: 18rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.56);
  box-shadow: 0 18rpx 46rpx rgba(15, 23, 42, 0.045);
  font-size: 22rpx;
  font-weight: 700;
  color: #1f2933;
  backdrop-filter: blur(14rpx);
  -webkit-backdrop-filter: blur(14rpx);
  pointer-events: auto;
}

.summary-card {
  border-radius: 34rpx;
  padding: 28rpx;
  box-sizing: border-box;
  background: var(--rf-focus-bg);
  box-shadow: 0 28rpx 72rpx rgba(15, 23, 42, 0.06);
  color: var(--rf-focus-text);
  margin-bottom: 24rpx;
}

.summary-card.is-collapsed {
  padding-bottom: 24rpx;
}

.summary-card__topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.summary-card__heading {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-width: 0;
}

.summary-card__title {
  font-size: 40rpx;
  line-height: 1.16;
  font-weight: 700;
  color: var(--rf-focus-text);
}

.summary-card__subtitle {
  display: block;
  font-size: 22rpx;
  line-height: 1.58;
  color: var(--rf-focus-muted);
}

.summary-card__toggle {
  flex-shrink: 0;
  min-height: 64rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--rf-focus-surface);
}

.summary-card__toggle-text {
  font-size: 20rpx;
  font-weight: 700;
  color: var(--rf-focus-text);
}

.summary-card__body {
  margin-top: 24rpx;
}

.summary-card__divider {
  height: 1rpx;
  margin: 18rpx 2rpx 0;
  background: rgba(255, 255, 255, 0.12);
}

.alphabet-panel {
  border-radius: 24rpx;
  padding: 18rpx;
  background: var(--rf-focus-surface);
  box-shadow: none;
}

.alphabet-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.alphabet-panel__title {
  font-size: 20rpx;
  color: var(--rf-focus-kicker);
}

.alphabet-panel__current {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--rf-focus-text);
}

.alphabet-grid {
  margin-top: 14rpx;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10rpx;
}

.alphabet-key {
  min-height: 56rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 700;
  color: var(--rf-focus-text);
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.alphabet-key.is-active {
  background: var(--rf-button-primary-bg);
  color: var(--rf-button-primary-text);
  border-color: transparent;
}

.alphabet-key.is-disabled {
  opacity: 0.28;
}

.alphabet-panel__meta {
  display: block;
  margin-top: 12rpx;
  font-size: 20rpx;
  color: var(--rf-focus-muted);
}

.state-card__stats,
.focus-metrics {
  display: flex;
  gap: 14rpx;
}

.state-stat,
.focus-metric {
  flex: 1;
  min-width: 0;
  padding: 20rpx 18rpx;
  border-radius: 24rpx;
}

.state-stat {
  background: rgba(255, 255, 255, 0.56);
  box-shadow: 0 18rpx 52rpx rgba(15, 23, 42, 0.045);
}

.state-stat__value,
.focus-metric__value {
  display: block;
  font-size: 34rpx;
  line-height: 1.1;
  font-weight: 700;
}

.state-stat__label,
.focus-metric__label {
  display: block;
  margin-top: 10rpx;
  font-size: 20rpx;
}

.state-stat__label {
  color: rgba(30, 36, 48, 0.58);
}

.state-card,
.loading-card,
.section-card {
  border-radius: 38rpx;
  padding: 32rpx;
  box-sizing: border-box;
}

.state-card,
.loading-card,
.section-card {
  background: rgba(255, 255, 255, 0.56);
  box-shadow: 0 20rpx 60rpx rgba(15, 23, 42, 0.05);
}

.state-card__eyebrow,
.loading-card__eyebrow {
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: rgba(30, 36, 48, 0.42);
}

.state-card__title,
.loading-card__title {
  display: block;
  margin-top: 14rpx;
  font-size: 42rpx;
  line-height: 1.2;
  font-weight: 700;
  color: #1f2933;
}

.state-card__desc,
.loading-card__desc {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(30, 36, 48, 0.68);
}

.state-card__actions {
  display: flex;
  gap: 14rpx;
  margin-top: 28rpx;
}

.loading-card {
  text-align: left;
}

.root-overview {
  margin-top: 22rpx;
}

.root-overview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.root-overview__heading {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-width: 0;
}

.root-overview__eyebrow {
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: var(--rf-focus-kicker);
}

.root-overview__title {
  font-size: 56rpx;
  line-height: 1.04;
  font-weight: 700;
}

.root-overview__flag {
  flex-shrink: 0;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: var(--rf-focus-flag);
  font-size: 20rpx;
  color: var(--rf-focus-text);
}

.root-overview__meaning {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  color: var(--rf-focus-text);
}

.root-overview__desc {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  line-height: 1.68;
  color: var(--rf-focus-muted);
}

.focus-metrics {
  margin-top: 28rpx;
}

.focus-metric {
  background: var(--rf-focus-surface);
}

.focus-metric__label {
  color: var(--rf-focus-muted);
}

.progress-block {
  margin-top: 28rpx;
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
  transition: width 0.28s ease;
}

.section-card {
  position: relative;
  margin-top: 24rpx;
}

.section-card__status {
  margin-bottom: 18rpx;
  padding: 14rpx 18rpx;
  border-radius: 18rpx;
  background: rgba(112, 193, 145, 0.12);
  font-size: 20rpx;
  color: rgba(74, 152, 110, 0.96);
}

.inline-empty {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.72);
}

.inline-empty__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2933;
}

.inline-empty__desc {
  font-size: 22rpx;
  line-height: 1.65;
  color: rgba(30, 36, 48, 0.64);
}

.learning-flow {
  margin-top: 24rpx;
}

.learning-item {
  box-sizing: border-box;
}

.learning-item--section {
  margin-top: 10rpx;
  margin-bottom: 10rpx;
}

.learning-item--word {
  margin-bottom: 14rpx;
}

.section-row {
  padding: 18rpx 20rpx 14rpx;
  border-left: 3rpx solid rgba(31, 41, 51, 0.1);
}

.section-row__eyebrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  font-size: 18rpx;
  color: rgba(31, 41, 51, 0.54);
}

.section-row__title {
  display: block;
  margin-top: 10rpx;
  font-size: 30rpx;
  line-height: 1.2;
  font-weight: 700;
  color: #1f2933;
}

.section-row__subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.55;
  color: rgba(30, 36, 48, 0.62);
}

.word-row {
  position: relative;
  overflow: hidden;
  border-radius: 24rpx;
  border: 1rpx solid rgba(31, 41, 51, 0.04);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.045);
  transition:
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    opacity 0.18s ease;
}

.word-row.is-pending {
  border-color: rgba(112, 193, 145, 0.18);
  box-shadow: 0 16rpx 36rpx rgba(84, 148, 110, 0.08);
  background: rgba(245, 250, 247, 0.94);
  opacity: 0.98;
}

.word-row.is-mastered {
  border-color: rgba(112, 193, 145, 0.2);
  background: rgba(242, 250, 246, 0.9);
  box-shadow: 0 14rpx 34rpx rgba(84, 148, 110, 0.06);
}

.word-row__content {
  min-height: 120rpx;
  padding: 22rpx 22rpx 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10rpx;
}

.word-row__main {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.word-row__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.word-row__word {
  font-size: 34rpx;
  line-height: 1.18;
  font-weight: 700;
  color: #1f2933;
  flex: 1;
  min-width: 0;
}

.word-row__mastered {
  flex-shrink: 0;
  width: 44rpx;
  height: 44rpx;
  border-radius: 999rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 800;
  color: rgba(74, 152, 110, 0.96);
  background: rgba(112, 193, 145, 0.14);
  opacity: 0;
  transform: scale(0.84);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease,
    background 0.12s ease;
  will-change: opacity, transform;
}

.word-row__mastered.is-visible {
  opacity: 1;
  transform: scale(1);
}

.word-row__favorite {
  flex-shrink: 0;
  min-height: 46rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18rpx;
  border: 1rpx solid rgba(30, 36, 48, 0.16);
  color: rgba(30, 36, 48, 0.7);
  background: rgba(255, 255, 255, 0.56);
}

.word-row__favorite.is-active {
  border-color: rgba(255, 126, 95, 0.35);
  background: rgba(255, 126, 95, 0.18);
  color: rgba(214, 89, 62, 0.96);
}

.word-row__translation {
  font-size: 22rpx;
  line-height: 1.52;
  color: rgba(31, 41, 51, 0.64);
}

.completion-card {
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(236, 248, 241, 0.82);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.completion-card__title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2933;
}

.completion-card__desc {
  font-size: 22rpx;
  line-height: 1.6;
  color: rgba(31, 41, 51, 0.66);
}

.action-button {
  min-height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
  box-sizing: border-box;
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

.learning-page.theme-dark-zen {
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
}

.theme-dark-zen .topbar-back-btn,
.theme-dark-zen .state-stat,
.theme-dark-zen .state-card,
.theme-dark-zen .loading-card,
.theme-dark-zen .section-card,
.theme-dark-zen .word-row,
.theme-dark-zen .inline-empty,
.theme-dark-zen .word-row__favorite {
  background: var(--rf-surface);
  box-shadow: var(--rf-card-shadow);
}

.theme-dark-zen .state-stat__value,
.theme-dark-zen .state-card__title,
.theme-dark-zen .loading-card__title,
.theme-dark-zen .inline-empty__title,
.theme-dark-zen .completion-card__title,
.theme-dark-zen .section-row__title,
.theme-dark-zen .word-row__word {
  color: var(--rf-text-strong);
}

.theme-dark-zen .state-stat__label,
.theme-dark-zen .state-card__desc,
.theme-dark-zen .loading-card__desc,
.theme-dark-zen .inline-empty__desc,
.theme-dark-zen .completion-card__desc,
.theme-dark-zen .section-row__eyebrow,
.theme-dark-zen .section-row__subtitle,
.theme-dark-zen .word-row__translation,
.theme-dark-zen .word-row__favorite,
.theme-dark-zen .state-card__eyebrow,
.theme-dark-zen .loading-card__eyebrow {
  color: var(--rf-text-muted);
}

.theme-dark-zen .word-row__mastered {
  color: var(--rf-success);
  background: rgba(112, 193, 145, 0.14);
}

.theme-dark-zen .section-card__status {
  background: rgba(112, 193, 145, 0.1);
  color: var(--rf-success);
}

.theme-dark-zen .completion-card {
  background: rgba(112, 193, 145, 0.08);
}

.theme-dark-zen .section-row {
  border-left-color: var(--rf-border-strong);
}

.theme-dark-zen .action-button--secondary {
  background: var(--rf-button-secondary-bg);
  color: var(--rf-button-secondary-text);
}

.theme-clay-pastel .summary-card__divider {
  background: rgba(31, 41, 51, 0.08);
}

.theme-clay-pastel .alphabet-key {
  background: rgba(255, 255, 255, 0.52);
  border-color: rgba(31, 41, 51, 0.08);
}
</style>
