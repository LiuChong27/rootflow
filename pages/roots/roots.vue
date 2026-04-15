<template>
  <view class="roots-page" :class="currentTheme">
    <view class="roots-shell">
      <view class="page-header">
        <view class="page-copy">
          <text class="page-kicker">ROOTFLOW MIND TREE</text>
          <text class="page-title">Roots 词根树</text>
          <text class="page-description"
            >从字母中心出发，沿着词根书原始顺序向外展开主干、分支和单词。</text
          >
        </view>
      </view>

      <view class="page-toolbar">
        <view
          class="seed-picker"
          :class="{ 'is-disabled': isLoading, 'is-open': isSeedDropdownOpen }"
          @tap="openSeedSelector"
        >
          <text class="seed-picker__label">字母</text>
          <text class="seed-picker__value">{{ currentSeed.toUpperCase() }}</text>
          <text class="seed-picker__count">{{ currentSeedWordCount }} 词</text>
          <text class="seed-picker__arrow">▾</text>
        </view>
        <view class="theme-toggle" :class="{ 'is-disabled': isLoading }" @tap="toggleTheme">
          <text>{{ currentTheme === 'theme-dark-zen' ? '夜' : '昼' }}</text>
        </view>
      </view>

      <view v-if="isSeedDropdownOpen" class="seed-dropdown">
        <view class="seed-dropdown__header">
          <text class="seed-dropdown__title">切换字母</text>
          <text class="seed-dropdown__meta">严格按现有词根树数据展示</text>
        </view>
        <view class="seed-dropdown__grid">
          <view
            v-for="option in alphabetOptions"
            :key="option.seed"
            class="seed-dropdown__item"
            :class="{
              'is-current': option.seed === currentSeed,
              'is-disabled': !option.available,
            }"
            @tap="selectAlphabetOption(option)"
          >
            <text class="seed-dropdown__item-letter">{{ option.label }}</text>
            <text class="seed-dropdown__item-count">{{
              option.available ? option.wordCount + ' 词' : '暂无'
            }}</text>
          </view>
        </view>
      </view>

      <view class="loading-banner" v-if="isLoading">
        <text>正在整理 {{ currentSeed.toUpperCase() }} 的词根树...</text>
      </view>
      <view class="error-banner" v-if="errorMsg">
        <text>{{ errorMsg }}</text>
      </view>

      <view class="mind-card">
        <view class="mind-card__header">
          <view class="mind-card__copy">
            <text class="mind-card__kicker">CENTER TREE</text>
            <text class="mind-card__title">{{ getRootDisplayName(baseRoot) }}</text>
            <text class="mind-card__subtitle">{{ getRootSubtitle(currentRootDetail) }}</text>
          </view>
          <view class="mind-stats">
            <view class="mind-stat">
              <text class="mind-stat__value">{{ topBranches.length }}</text>
              <text class="mind-stat__label">一级主干</text>
            </view>
            <view class="mind-stat">
              <text class="mind-stat__value">{{
                currentRootDetail ? currentRootDetail.childCount || 0 : 0
              }}</text>
              <text class="mind-stat__label">直接子枝</text>
            </view>
            <view class="mind-stat">
              <text class="mind-stat__value">{{
                currentRootDetail
                  ? currentRootDetail.descendantWordCount || currentRootDetail.wordCount || 0
                  : 0
              }}</text>
              <text class="mind-stat__label">关联单词</text>
            </view>
          </view>
        </view>

        <scroll-view v-if="focusPath.length" class="path-rail" scroll-x :show-scrollbar="false">
          <view class="path-track">
            <view
              v-for="crumb in focusPath"
              :key="crumb.rootId"
              class="path-pill"
              :class="{
                'is-current':
                  crumb.rootId === focusedNodeId ||
                  (!focusedNodeId && baseRoot && crumb.rootId === baseRoot.rootId),
              }"
              @tap="selectBreadcrumb(crumb.rootId)"
            >
              <text>{{ getRootDisplayName(crumb) }}</text>
            </view>
          </view>
        </scroll-view>

        <view class="mind-hint" v-if="hintText">
          <text>{{ hintText }}</text>
        </view>

        <view class="tree-viewport">
          <scroll-view
            class="tree-scroll"
            scroll-x
            scroll-y
            :show-scrollbar="false"
            :scroll-left="treeScrollLeft"
            :scroll-top="treeScrollTop"
            :scroll-with-animation="isAutoScrollingTree"
            @scroll="handleTreeScroll"
          >
            <view
              class="tree-stage"
              :style="{ width: treeModel.width + 'px', height: treeModel.height + 'px' }"
            >
              <canvas
                canvas-id="mindTreeCanvas"
                class="tree-canvas"
                :style="{ width: treeModel.width + 'px', height: treeModel.height + 'px' }"
              ></canvas>

              <view v-if="treeModel.nodes.length" class="tree-node-layer">
                <view
                  v-for="node in treeModel.nodes"
                  :key="node.id"
                  class="tree-node"
                  :class="getNodeClasses(node)"
                  :style="getNodeStyle(node)"
                  @tap="handleTreeNodeTap(node)"
                >
                  <text class="tree-node__eyebrow" v-if="node.eyebrow">{{ node.eyebrow }}</text>
                  <text class="tree-node__title">{{ node.title }}</text>
                  <text class="tree-node__subtitle" v-if="node.subtitle">{{ node.subtitle }}</text>
                  <text class="tree-node__badge" v-if="node.badge">{{ node.badge }}</text>
                </view>
              </view>

              <view
                v-if="activeWordCardNode && activeWordCardStyle"
                class="word-card-node"
                :style="activeWordCardStyle"
              >
                <view
                  class="word-card"
                  :class="{ 'is-playing': audioPlayingWordId === activeWordCardId }"
                >
                  <view class="word-card__close" @tap="activeWordCardId = ''">×</view>
                  <view class="word-card__header">
                    <text class="word-card__word">{{
                      getWordDisplayName(activeWordCardData)
                    }}</text>
                    <view
                      v-if="activeWordCardData.status === wordRepo.STATUS_MASTERED"
                      class="word-card__status"
                      >已掌握</view
                    >
                  </view>
                  <text v-if="activeWordCardData.phonetic" class="word-card__phonetic">{{
                    activeWordCardData.phonetic
                  }}</text>
                  <text v-if="activeWordCardData.translation" class="word-card__translation">{{
                    activeWordCardData.translation
                  }}</text>
                  <text v-if="activeWordCardData.sentence" class="word-card__sentence">{{
                    activeWordCardData.sentence
                  }}</text>
                  <view class="word-card__actions">
                    <view
                      class="word-card__button word-card__button--primary"
                      @tap="toggleWordMastered(activeWordCardData)"
                    >
                      <text>{{
                        activeWordCardData.status === wordRepo.STATUS_MASTERED
                          ? '取消掌握'
                          : '标记掌握'
                      }}</text>
                    </view>
                    <view class="word-card__button" @tap="syncWordProgress">
                      <text>{{ isCloudLinked ? '同步进度' : '仅本地保存' }}</text>
                    </view>
                  </view>
                </view>
              </view>

              <view v-else-if="!isLoading && !errorMsg && !hasRenderableTree" class="tree-empty">
                <text>当前字母暂时没有可展示的词根树。</text>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import authService from '../../services/authService';
import progressSyncService from '../../services/progressSyncService';
import wordRepo from '../../services/wordRepo';

const WORD_DOUBLE_TAP_WINDOW = 280;

const TYPE_LABELS = {
  section: '前缀',
  prefix: '前缀',
  root: '词根',
  branch: '分支',
  category: '类别',
};

const THEME_LINES = {
  'theme-dark-zen': {
    primary: 'rgba(255, 126, 95, 0.9)',
    secondary: 'rgba(132, 197, 255, 0.78)',
    tertiary: 'rgba(255, 255, 255, 0.24)',
  },
  'theme-clay-pastel': {
    primary: 'rgba(235, 104, 74, 0.84)',
    secondary: 'rgba(78, 153, 209, 0.72)',
    tertiary: 'rgba(76, 95, 116, 0.2)',
  },
};

const NODE_METRICS = {
  // 优化：减少节点尺寸，使树更紧凑，更像思维导图
  base: { minWidth: 68, maxWidth: 82, height: 72, titleSize: 22, subtitleSize: 10, paddingX: 14 },
  section: {
    minWidth: 80,
    maxWidth: 140,
    height: 48,
    titleSize: 13,
    subtitleSize: 10,
    paddingX: 12,
  },
  root: { minWidth: 70, maxWidth: 130, height: 44, titleSize: 12, subtitleSize: 10, paddingX: 12 },
  branch: { minWidth: 68, maxWidth: 120, height: 40, titleSize: 11, subtitleSize: 9, paddingX: 10 },
  category: {
    minWidth: 68,
    maxWidth: 115,
    height: 38,
    titleSize: 11,
    subtitleSize: 9,
    paddingX: 10,
  },
  word: { minWidth: 72, maxWidth: 180, height: 32, titleSize: 10, subtitleSize: 9, paddingX: 10 },
};

const ALPHABET_SEEDS = 'abcdefghijklmnopqrstuvwxyz'.split('');

const LAYOUT = {
  paddingX: 48, // 优化：从 64 → 48
  paddingY: 36, // 优化：从 48 → 36
  branchGap: 12, // 优化：从 16 → 12
  leafGap: 8, // 优化：从 10 → 8
  trunkGapX: 32, // 优化：从 40 → 32
  depthGapX: 24, // 优化：从 32 → 24
  baseMinHeight: 600, // 优化：从 800 → 600
};

const textWidthCache = Object.create(null);

function normalizeText(input) {
  return String(input || '').trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ellipsis(text, maxLength) {
  const source = normalizeText(text);
  if (!source) return '';
  if (source.length <= maxLength) return source;
  return source.slice(0, Math.max(1, maxLength - 1)) + '...';
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function getTypeLabel(type) {
  const normalized = normalizeText(type).toLowerCase();
  return TYPE_LABELS[normalized] || '节点';
}

function estimateTextWidth(text, fontSize) {
  const source = normalizeText(text);
  const cacheKey = fontSize + ':' + source;
  if (textWidthCache[cacheKey]) return textWidthCache[cacheKey];
  let units = 0;
  for (const char of source) {
    if (/\s/.test(char)) units += 0.34;
    else if (/[A-Z0-9]/.test(char)) units += 0.66;
    else if (/[a-z]/.test(char)) units += 0.56;
    else units += 1;
  }
  const width = units * fontSize;
  textWidthCache[cacheKey] = width;
  return width;
}

function getNodeMetric(kind) {
  return NODE_METRICS[kind] || NODE_METRICS.root;
}

function measureNodeSize(kind, title, subtitle, eyebrow, badge) {
  const metric = getNodeMetric(kind);
  const contentWidth = Math.max(
    estimateTextWidth(title, metric.titleSize),
    subtitle ? estimateTextWidth(subtitle, metric.subtitleSize) : 0,
    eyebrow ? estimateTextWidth(eyebrow, 10) : 0,
    badge ? estimateTextWidth(badge, 10) : 0,
  );
  return {
    width: Math.round(clamp(contentWidth + metric.paddingX * 2, metric.minWidth, metric.maxWidth)),
    height: metric.height,
  };
}

export default {
  data() {
    return {
      wordRepo,
      currentTheme: 'theme-dark-zen',
      currentSeed: 'a',
      seedList: [],
      seedStats: {},
      isSeedDropdownOpen: false,
      dataSourceHealth: null,
      baseRoot: null,
      topBranches: [],
      branchSnapshots: {},
      expandedNodeIds: [],
      expandedWordRootIds: new Set(),
      focusPath: [],
      activePathIds: [],
      focusedNodeId: '',
      activeWordCardId: '',
      audioPlayingWordId: '',
      lastTappedWordId: '',
      lastTappedWordAt: 0,
      audioContext: null,
      isSyncingProgress: false,
      errorMsg: '',
      isLoading: false,
      loadingCounter: 0,
      viewportWidth: 320,
      viewportHeight: 480,
      canvasContext: null,
      drawTimer: null,
      treeScrollLeft: 0,
      treeScrollTop: 0,
      hasUserScrolledTree: false,
      hasInitialTreePositioned: false,
      isAutoScrollingTree: false,
      autoScrollReleaseTimer: null,
      treeSideMap: {},
      cachedTreeModel: null,
      treeModelDeps: { expandedIds: null, expandedWordRootIds: null, focusPath: null },
      requestState: {
        seed: 0,
        branch: 0,
      },
    };
  },

  computed: {
    topBranchIds() {
      return (this.topBranches || []).map((item) => item.rootId).filter(Boolean);
    },
    currentRootDetail() {
      if (
        this.focusedNodeId &&
        this.branchSnapshots[this.focusedNodeId] &&
        this.branchSnapshots[this.focusedNodeId].root
      ) {
        return this.branchSnapshots[this.focusedNodeId].root;
      }
      return this.baseRoot || null;
    },
    treeModel() {
      return this.buildTreeModel();
    },
    currentSeedWordCount() {
      return this.getSeedWordCount(this.currentSeed);
    },
    baseSnapshot() {
      const baseRootId = this.baseRoot && this.baseRoot.rootId;
      if (!baseRootId) return null;
      return this.getSnapshot(baseRootId) || null;
    },
    alphabetOptions() {
      return ALPHABET_SEEDS.map((seed) => ({
        seed,
        label: seed.toUpperCase(),
        available: this.seedList.includes(seed),
        wordCount: this.getSeedWordCount(seed),
      }));
    },
    hasRenderableTree() {
      if (!this.baseRoot) return false;
      if ((this.topBranches || []).length) return true;
      const baseSnapshot = this.baseSnapshot;
      return Boolean(
        baseSnapshot &&
          Array.isArray(baseSnapshot.words) &&
          baseSnapshot.words.length &&
          this.shouldShowWords(this.baseRoot.rootId, baseSnapshot),
      );
    },
    isCloudLinked() {
      return authService.isLoggedIn();
    },
    hintText() {
      if (this.errorMsg) return '';
      if (this.isLoading) return '正在同步词根树...';
      if (this.focusedNodeId) return '单击词根继续展开或收起，单击单词看卡片，双击朗读。';
      return '单击词根探索整棵词根树，单击单词看卡片，双击朗读。';
    },
    activeWordCardData() {
      if (!this.activeWordCardId) return null;
      // 从树节点中查找活跃卡片的单词数据
      const model = this.treeModel;
      const node = model.nodes.find((n) => n.id === 'word-' + this.activeWordCardId);
      return node && node.data ? node.data : null;
    },
    activeWordCardNode() {
      if (!this.activeWordCardId || !this.activeWordCardData) return null;
      // 获取卡片对应的树节点位置信息
      const model = this.treeModel;
      const node = model.nodes.find((n) => n.id === 'word-' + this.activeWordCardId);
      if (!node) return null;
      return {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        cardWidth: 200,
        cardTop: 20,
      };
    },
    activeWordCardStyle() {
      if (!this.activeWordCardNode) return null;
      const stageWidth = Math.max(320, Number(this.treeModel && this.treeModel.width) || 320);
      const stageHeight = Math.max(220, Number(this.treeModel && this.treeModel.height) || 600);
      const cardWidth = 220;
      const cardMinHeight = 140;
      const margin = 8;
      let left = this.activeWordCardNode.x - cardWidth / 2;
      left = clamp(left, margin, Math.max(margin, stageWidth - cardWidth - margin));
      let top = this.activeWordCardNode.y + this.activeWordCardNode.height / 2 + 10;
      const maxTop = Math.max(margin, stageHeight - cardMinHeight - margin);
      if (top > maxTop) {
        top = this.activeWordCardNode.y - this.activeWordCardNode.height / 2 - cardMinHeight - 10;
      }
      top = clamp(top, margin, maxTop);
      return {
        left: Math.round(left) + 'px',
        top: Math.round(top) + 'px',
        width: cardWidth + 'px',
      };
    },
  },

  async onLoad() {
    const savedTheme = uni.getStorageSync('user_theme');
    if (savedTheme) this.currentTheme = savedTheme;
    try {
      await progressSyncService.hydrateProgressFromCloud();
    } catch (error) {
      // 未登录或云端不可用时继续使用本地进度
    }
    this.initializeSeeds();
  },

  onReady() {
    this.syncViewport();
  },

  onResize() {
    this.$nextTick(() => {
      this.syncViewport();
    });
  },

  updated() {
    if (!this.isAutoScrollingTree) {
      this.scheduleDraw();
    }
  },

  onUnload() {
    if (this.drawTimer) {
      clearTimeout(this.drawTimer);
      this.drawTimer = null;
    }
    if (this.autoScrollReleaseTimer) {
      clearTimeout(this.autoScrollReleaseTimer);
      this.autoScrollReleaseTimer = null;
    }
    this.destroyAudioContext();
  },

  methods: {
    beginRequest(scope) {
      const nextToken = Number(this.requestState[scope] || 0) + 1;
      this.requestState = { ...this.requestState, [scope]: nextToken };
      return nextToken;
    },

    isLatestRequest(scope, token) {
      return Number(this.requestState[scope] || 0) === Number(token || 0);
    },

    openSeedSelector() {
      if (this.isLoading) return;
      this.isSeedDropdownOpen = !this.isSeedDropdownOpen;
    },

    closeSeedDropdown() {
      this.isSeedDropdownOpen = false;
    },

    selectAlphabetOption(option) {
      if (!option || !option.seed) return;
      this.closeSeedDropdown();
      if (!option.available) {
        uni.showToast({ title: option.label + ' 暂无词根树', icon: 'none' });
        return;
      }
      this.selectSeed(option.seed);
    },

    destroyAudioContext() {
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

    startLoading() {
      this.loadingCounter = Number(this.loadingCounter || 0) + 1;
      this.isLoading = true;
    },

    stopLoading() {
      this.loadingCounter = Math.max(0, Number(this.loadingCounter || 0) - 1);
      this.isLoading = this.loadingCounter > 0;
    },

    formatRepoError(error) {
      const code = error && error.code ? error.code : '';
      if (code === wordRepo.RAW_DATA_ERROR_CODE) {
        return '词根原始数据不可用，请检查 data/raw 后重新生成。';
      }
      const message = String((error && error.message) || '');
      if (message.includes('No raw root data found')) {
        return '检测到部分词根原始数据缺失，请重新执行数据构建脚本。';
      }
      return '词根树加载失败，请稍后重试。';
    },

    getSeedWordCount(seed) {
      const stat = this.seedStats[seed];
      return stat && typeof stat.wordCount === 'number' ? stat.wordCount : 0;
    },

    getRootDisplayName(root) {
      const label = normalizeText((root && (root.root || root.rootId)) || '');
      if (!label) return this.currentSeed.toUpperCase();
      return label.length <= 3 ? label.toUpperCase() : label;
    },

    getRootSubtitle(root) {
      const description = normalizeText((root && root.descriptionCn) || '');
      const meaning = normalizeText((root && root.meaning) || '');
      if (description && meaning) return description + ' / ' + meaning;
      return (
        description ||
        meaning ||
        getTypeLabel(root && root.type) +
          ' · ' +
          Number((root && (root.descendantWordCount || root.wordCount)) || 0) +
          ' 词'
      );
    },

    getRootDescription(root) {
      if (!root) return '点击任意主干后，这里会显示该词根的含义、层级、代表词和当前支线单词。';
      const description = normalizeText(root.descriptionCn);
      const meaning = normalizeText(root.meaning);
      if (description && meaning) return description + '（' + meaning + '）';
      return description || meaning || '当前词根暂时没有补充说明。';
    },

    getWordDisplayName(word) {
      return normalizeText((word && (word.word || word.canonical)) || '');
    },

    getWordSubtitle(word) {
      return (
        normalizeText((word && word.phonetic) || '') ||
        normalizeText((word && word.translation) || '') ||
        '已选中单词'
      );
    },
    async initializeSeeds() {
      this.errorMsg = '';
      this.dataSourceHealth =
        typeof wordRepo.getDataSourceHealth === 'function'
          ? wordRepo.getDataSourceHealth()
          : { ok: true };
      if (this.dataSourceHealth && this.dataSourceHealth.ok === false) {
        this.seedList = [];
        this.seedStats = {};
        this.currentSeed = '';
        this.baseRoot = null;
        this.topBranches = [];
        this.errorMsg = this.formatRepoError(this.dataSourceHealth);
        return;
      }
      try {
        const seedEntries = wordRepo.listRootSeeds();
        this.seedList = seedEntries.map((item) => item.seed);
        this.seedStats = seedEntries.reduce((acc, item) => {
          acc[item.seed] = item;
          return acc;
        }, {});
        if (!this.seedList.length) {
          this.errorMsg = '词根数据为空，请先生成 raw 数据。';
          return;
        }
        const cachedSeed = normalizeText(uni.getStorageSync('rf_root_seed')).toLowerCase();
        if (cachedSeed && this.seedList.includes(cachedSeed)) this.currentSeed = cachedSeed;
        else if (this.seedList.includes('a')) this.currentSeed = 'a';
        else this.currentSeed = this.seedList[0];
        await this.loadSeedMindTree();
      } catch (error) {
        this.errorMsg = this.formatRepoError(error);
      }
    },

    buildTopBranchSnapshot(branch, siblings) {
      return {
        root: {
          rootId: branch.rootId,
          root: branch.root,
          meaning: branch.meaning,
          descriptionCn: branch.descriptionCn,
          parentRootId: branch.parentRootId,
          rootLevel: branch.rootLevel,
          rootPath: branch.rootPath,
          type: branch.type,
          notes: branch.notes,
          sourceLabel: branch.sourceLabel,
          tags: Array.isArray(branch.tags) ? [...branch.tags] : [],
          sourceIndex: branch.sourceIndex,
          sideHint: branch.sideHint,
          wordCount: Number(branch.wordCount || 0),
          childCount: Number(branch.childCount || branch.totalChildren || 0),
          descendantWordCount: Number(branch.descendantWordCount || branch.wordCount || 0),
          hasChildren: Boolean(branch.hasChildren),
          sampleWords: Array.isArray(branch.sampleWords) ? [...branch.sampleWords] : [],
          file: branch.file || branch.rootId,
        },
        path: [this.baseRoot, branch].filter(Boolean),
        parent: this.baseRoot,
        siblings,
        children: Array.isArray(branch.previewChildren) ? branch.previewChildren : [],
        words: Array.isArray(branch.previewWords) ? branch.previewWords : [],
        totalSiblings: siblings.length,
        totalChildren: Number(branch.totalChildren || branch.childCount || 0),
        totalWords: Number(branch.totalWords || branch.wordCount || 0),
      };
    },

    buildBaseSnapshot(siblings = []) {
      if (!this.baseRoot) return null;
      const baseWords = Array.isArray(this.baseRoot.words) ? this.baseRoot.words : [];
      return {
        root: this.baseRoot,
        path: [this.baseRoot],
        parent: null,
        siblings: [],
        children: siblings,
        words: baseWords,
        totalSiblings: 0,
        totalChildren: siblings.length,
        totalWords: baseWords.length,
      };
    },

    async loadSeedMindTree() {
      if (!this.currentSeed) return;
      this.closeSeedDropdown();
      const requestToken = this.beginRequest('seed');
      this.startLoading();
      this.errorMsg = '';
      try {
        const tree = await wordRepo.getSeedMindTree(this.currentSeed);
        if (!this.isLatestRequest('seed', requestToken)) return;
        this.baseRoot = tree.baseRoot;
        this.topBranches = Array.isArray(tree.branches) ? tree.branches : [];
        this.treeSideMap = this.topBranches.reduce((acc, branch) => {
          acc[branch.rootId] = branch.sideHint || 'left';
          return acc;
        }, {});
        const siblings = this.topBranches.map((item) => ({
          rootId: item.rootId,
          root: item.root,
          meaning: item.meaning,
          descriptionCn: item.descriptionCn,
          parentRootId: item.parentRootId,
          rootLevel: item.rootLevel,
          rootPath: item.rootPath,
          type: item.type,
          notes: item.notes,
          sourceLabel: item.sourceLabel,
          tags: Array.isArray(item.tags) ? [...item.tags] : [],
          sourceIndex: item.sourceIndex,
          sideHint: item.sideHint,
          wordCount: Number(item.wordCount || 0),
          childCount: Number(item.childCount || item.totalChildren || 0),
          descendantWordCount: Number(item.descendantWordCount || item.wordCount || 0),
          hasChildren: Boolean(item.hasChildren),
          sampleWords: Array.isArray(item.sampleWords) ? [...item.sampleWords] : [],
          file: item.file || item.rootId,
        }));
        const snapshotMap = this.topBranches.reduce((acc, branch) => {
          acc[branch.rootId] = this.buildTopBranchSnapshot(branch, siblings);
          return acc;
        }, {});
        const baseSnapshot = this.buildBaseSnapshot(siblings);
        if (baseSnapshot && this.baseRoot && this.baseRoot.rootId) {
          snapshotMap[this.baseRoot.rootId] = baseSnapshot;
        }
        this.branchSnapshots = snapshotMap;
        // 首屏保持一级主干展开，后续由点击交互控制逐层展开/收起
        this.expandedNodeIds = this.topBranches.map((item) => item.rootId);
        this.expandedWordRootIds =
          !this.topBranches.length &&
          baseSnapshot &&
          Array.isArray(baseSnapshot.words) &&
          baseSnapshot.words.length
            ? new Set([this.baseRoot.rootId])
            : new Set();
        this.cachedTreeModel = null; // 清除缓存，避免显示旧数据
        this.focusedNodeId = '';
        this.activeWordCardId = '';
        this.audioPlayingWordId = '';
        this.lastTappedWordId = '';
        this.lastTappedWordAt = 0;
        this.focusPath = this.baseRoot ? [this.baseRoot] : [];
        this.activePathIds = this.baseRoot ? [this.baseRoot.rootId] : [];
        this.treeScrollLeft = 0;
        this.treeScrollTop = 0;
        this._treeViewportScrollLeft = 0;
        this._treeViewportScrollTop = 0;
        this.hasUserScrolledTree = false;
        this.hasInitialTreePositioned = false;
        uni.setStorageSync('rf_root_seed', this.currentSeed);
        this.$nextTick(() => {
          this.centerTreeNode(this.baseRoot ? 'base-' + this.baseRoot.rootId : '', {
            animate: false,
          });
          this.hasInitialTreePositioned = true;
          this.scheduleDraw();
        });
      } catch (error) {
        if (!this.isLatestRequest('seed', requestToken)) return;
        this.baseRoot = null;
        this.topBranches = [];
        this.branchSnapshots = {};
        this.errorMsg = this.formatRepoError(error);
      } finally {
        this.stopLoading();
      }
    },

    selectSeed(seed) {
      if (!seed || seed === this.currentSeed || this.isLoading) return;
      this.closeSeedDropdown();
      this.currentSeed = seed;
      this.loadSeedMindTree();
    },

    selectBreadcrumb(rootId) {
      if (!rootId) return;
      this.openRoot(rootId);
    },

    buildExpandedIds(pathIds, rootId) {
      const preserved = Array.isArray(this.expandedNodeIds) ? this.expandedNodeIds : [];
      return uniqueIds(
        [].concat(
          preserved,
          Array.isArray(pathIds)
            ? pathIds.filter((item) => item !== (this.baseRoot && this.baseRoot.rootId))
            : [],
          [rootId],
        ),
      );
    },

    normalizeRootId(rootId) {
      return normalizeText(rootId).toLowerCase();
    },

    isRootNodeKind(kind) {
      return kind === 'root' || kind === 'section' || kind === 'branch' || kind === 'category';
    },

    releaseAutoScrollLock() {
      if (this.autoScrollReleaseTimer) clearTimeout(this.autoScrollReleaseTimer);
      this.autoScrollReleaseTimer = setTimeout(() => {
        this.isAutoScrollingTree = false;
        this.autoScrollReleaseTimer = null;
      }, 220);
    },

    setTreeScroll(nextLeft, nextTop, options = {}) {
      const { animate = true } = options;
      const normalizedLeft = Math.max(0, Math.round(Number(nextLeft) || 0));
      const normalizedTop = Math.max(0, Math.round(Number(nextTop) || 0));
      this._treeViewportScrollLeft = normalizedLeft;
      this._treeViewportScrollTop = normalizedTop;
      this.isAutoScrollingTree = animate;
      this.treeScrollLeft = normalizedLeft;
      this.treeScrollTop = normalizedTop;
      if (!animate) {
        this.isAutoScrollingTree = false;
        if (this.autoScrollReleaseTimer) {
          clearTimeout(this.autoScrollReleaseTimer);
          this.autoScrollReleaseTimer = null;
        }
        return;
      }
      this.releaseAutoScrollLock();
    },

    handleTreeScroll(event) {
      const detail = (event && event.detail) || {};
      this._treeViewportScrollLeft = Math.max(0, Math.round(Number(detail.scrollLeft) || 0));
      this._treeViewportScrollTop = Math.max(0, Math.round(Number(detail.scrollTop) || 0));
      if (!this.isAutoScrollingTree) {
        this.hasUserScrolledTree = true;
      }
    },

    getViewportBounds() {
      const currentLeft = Number((this._treeViewportScrollLeft ?? this.treeScrollLeft) || 0);
      const currentTop = Number((this._treeViewportScrollTop ?? this.treeScrollTop) || 0);
      return {
        minX: currentLeft,
        maxX: currentLeft + Number(this.viewportWidth || 0),
        minY: currentTop,
        maxY: currentTop + Number(this.viewportHeight || 0),
      };
    },

    getNodesBounds(nodes) {
      const list = Array.isArray(nodes) ? nodes.filter(Boolean) : [];
      if (!list.length) return null;
      return list.reduce(
        (acc, node) => ({
          minX: Math.min(acc.minX, node.x - node.width / 2),
          maxX: Math.max(acc.maxX, node.x + node.width / 2),
          minY: Math.min(acc.minY, node.y - node.height / 2),
          maxY: Math.max(acc.maxY, node.y + node.height / 2),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        },
      );
    },

    getBranchNodes(rootId, options = {}) {
      const { includeChildren = true, includeWords = true } = options;
      const normalizedRootId = this.normalizeRootId(rootId);
      if (!normalizedRootId) return [];
      const model = this.treeModel;
      return (model.nodes || []).filter((node) => {
        if (!node) return false;
        if (node.id === 'root-' + normalizedRootId) return true;
        if (
          includeWords &&
          node.kind === 'word' &&
          this.normalizeRootId(node.ownerId) === normalizedRootId
        ) {
          return true;
        }
        if (
          includeChildren &&
          this.isRootNodeKind(node.kind) &&
          this.normalizeRootId(node.data && node.data.parentRootId) === normalizedRootId
        ) {
          return true;
        }
        return false;
      });
    },

    ensureNodesVisible(nodes, options = {}) {
      const { padding = 24, animate = true } = options;
      const bounds = this.getNodesBounds(nodes);
      if (!bounds) return;
      const viewport = this.getViewportBounds();
      let nextLeft = viewport.minX;
      let nextTop = viewport.minY;
      const horizontalPadding = Math.min(padding, Math.max(12, this.viewportWidth / 6));
      const verticalPadding = Math.min(padding, Math.max(12, this.viewportHeight / 6));

      if (bounds.minX < viewport.minX + horizontalPadding) {
        nextLeft = bounds.minX - horizontalPadding;
      } else if (bounds.maxX > viewport.maxX - horizontalPadding) {
        nextLeft = bounds.maxX - this.viewportWidth + horizontalPadding;
      }

      if (bounds.minY < viewport.minY + verticalPadding) {
        nextTop = bounds.minY - verticalPadding;
      } else if (bounds.maxY > viewport.maxY - verticalPadding) {
        nextTop = bounds.maxY - this.viewportHeight + verticalPadding;
      }

      const normalizedLeft = Math.max(0, Math.round(nextLeft));
      const normalizedTop = Math.max(0, Math.round(nextTop));
      const currentLeft = Math.max(
        0,
        Math.round(Number(this._treeViewportScrollLeft ?? this.treeScrollLeft) || 0),
      );
      const currentTop = Math.max(
        0,
        Math.round(Number(this._treeViewportScrollTop ?? this.treeScrollTop) || 0),
      );
      if (normalizedLeft === currentLeft && normalizedTop === currentTop) return;
      this.setTreeScroll(normalizedLeft, normalizedTop, { animate });
    },

    ensureBranchVisible(rootId, options = {}) {
      const branchNodes = this.getBranchNodes(rootId, options);
      this.ensureNodesVisible(branchNodes, { padding: 28, animate: true });
    },

    getLoadedDescendantRootIds(rootId) {
      const normalizedRootId = this.normalizeRootId(rootId);
      if (!normalizedRootId) return [];
      return Object.keys(this.branchSnapshots || {}).filter((snapshotRootId) => {
        const normalizedSnapshotRootId = this.normalizeRootId(snapshotRootId);
        if (!normalizedSnapshotRootId) return false;
        if (normalizedSnapshotRootId === normalizedRootId) return true;
        const snapshot = this.branchSnapshots[snapshotRootId];
        const pathIds = Array.isArray(snapshot && snapshot.path)
          ? snapshot.path.map((item) => this.normalizeRootId(item && item.rootId)).filter(Boolean)
          : [];
        return pathIds.includes(normalizedRootId);
      });
    },

    collapseRootBranch(rootId) {
      const normalizedRootId = this.normalizeRootId(rootId);
      if (!normalizedRootId) return;
      const targetIds = new Set(this.getLoadedDescendantRootIds(normalizedRootId));
      if (!targetIds.size) targetIds.add(normalizedRootId);
      this.expandedNodeIds = (this.expandedNodeIds || []).filter(
        (item) => !targetIds.has(this.normalizeRootId(item)),
      );
      this.expandedWordRootIds = new Set(
        Array.from(this.expandedWordRootIds || []).filter(
          (item) => !targetIds.has(this.normalizeRootId(item)),
        ),
      );
      if (targetIds.has(this.normalizeRootId(this.focusedNodeId))) {
        this.focusedNodeId = normalizedRootId;
      }
      this.cachedTreeModel = null;
      this.activeWordCardId = '';
      this.lastTappedWordId = '';
      this.lastTappedWordAt = 0;
      this.$nextTick(() => {
        this.ensureBranchVisible(normalizedRootId, { includeChildren: false, includeWords: false });
        this.scheduleDraw();
      });
    },

    async toggleRootNode(node) {
      const rootId = this.normalizeRootId(node && node.data && node.data.rootId);
      if (!rootId) return;
      const isExpanded = (this.expandedNodeIds || []).includes(rootId);
      if (isExpanded) {
        this.collapseRootBranch(rootId);
        return;
      }
      const requestToken = this.beginRequest('branch');
      this.errorMsg = '';
      try {
        const snapshot =
          this.getSnapshot(rootId) ||
          (await this.fetchBranchSnapshot(rootId, {}, { scope: 'branch', token: requestToken }));
        if (!snapshot || !this.isLatestRequest('branch', requestToken)) return;
        this.expandedNodeIds = uniqueIds([...(this.expandedNodeIds || []), rootId]);
        this.expandedWordRootIds = new Set([...(this.expandedWordRootIds || []), rootId]);
        this.focusedNodeId = rootId;
        this.focusPath =
          Array.isArray(snapshot && snapshot.path) && snapshot.path.length
            ? snapshot.path
            : this.baseRoot
              ? [this.baseRoot]
              : [];
        this.activePathIds = uniqueIds(this.focusPath.map((item) => item.rootId));
        this.cachedTreeModel = null;
        this.$nextTick(() => {
          this.ensureBranchVisible(rootId);
          this.scheduleDraw();
        });
      } catch (error) {
        if (!this.isLatestRequest('branch', requestToken)) return;
        this.errorMsg = this.formatRepoError(error);
      }
    },

    handleWordTap(word) {
      if (!word || !word.id) return;
      const now = Date.now();
      const normalizedWordId = normalizeText(word.id).toLowerCase();
      this.activeWordCardId = normalizedWordId;
      const isDoubleTap =
        this.lastTappedWordId === normalizedWordId &&
        now - this.lastTappedWordAt <= WORD_DOUBLE_TAP_WINDOW;
      this.lastTappedWordId = normalizedWordId;
      this.lastTappedWordAt = now;
      if (isDoubleTap) {
        this.lastTappedWordId = '';
        this.lastTappedWordAt = 0;
        this.playWordPronunciation(word);
      }
    },
    async toggleWordMastered(word) {
      if (!word || !word.id || this.isSyncingProgress) return;
      const nextStatus =
        word.status === wordRepo.STATUS_MASTERED ? wordRepo.STATUS_NEW : wordRepo.STATUS_MASTERED;
      this.isSyncingProgress = true;
      try {
        if (this.isCloudLinked) {
          await progressSyncService.markWordStatusAndSync(word.id, nextStatus);
        } else {
          wordRepo.setWordStatus(word.id, nextStatus);
        }
        await this.refreshActiveBranchProgress(word.id);
        uni.showToast({
          title: nextStatus === wordRepo.STATUS_MASTERED ? '已标记掌握' : '已恢复为新词',
          icon: 'none',
        });
      } catch (error) {
        uni.showToast({ title: error.message || '保存失败', icon: 'none' });
      } finally {
        this.isSyncingProgress = false;
      }
    },
    async syncWordProgress() {
      if (!this.isCloudLinked) {
        uni.showToast({ title: '当前仅保存在本地', icon: 'none' });
        return;
      }
      this.isSyncingProgress = true;
      try {
        await progressSyncService.syncProgressToCloud();
        uni.showToast({ title: '进度已同步', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '同步失败', icon: 'none' });
      } finally {
        this.isSyncingProgress = false;
      }
    },
    async refreshActiveBranchProgress(wordId) {
      const ownerId = normalizeText(
        (this.activeWordCardData && this.activeWordCardData.rootId) ||
          this.focusedNodeId ||
          (this.baseRoot && this.baseRoot.rootId),
      ).toLowerCase();
      if (!ownerId) return;

      if (this.baseRoot && ownerId === this.baseRoot.rootId) {
        await this.loadSeedMindTree();
        return;
      }

      const snapshot = await this.fetchBranchSnapshot(ownerId, {}, {});
      if (snapshot && Array.isArray(snapshot.words)) {
        const refreshedWord = snapshot.words.find((item) => item.id === wordId);
        if (refreshedWord) {
          this.activeWordCardId = refreshedWord.id;
        }
      }
      this.cachedTreeModel = null;
    },

    async fetchBranchSnapshot(rootId, options, requestMeta) {
      const normalizedRootId = normalizeText(rootId).toLowerCase();
      if (!normalizedRootId) return null;
      const scope = normalizeText(requestMeta && requestMeta.scope) || 'branch';
      const token = Number((requestMeta && requestMeta.token) || 0);
      const snapshot = await wordRepo.getRootBranch(normalizedRootId, options);
      if (token && !this.isLatestRequest(scope, token)) return null;
      this.branchSnapshots = { ...this.branchSnapshots, [normalizedRootId]: snapshot };
      return snapshot;
    },

    async openRoot(rootId) {
      const normalizedRootId = normalizeText(rootId).toLowerCase();
      if (!normalizedRootId) return;
      if (normalizedRootId === (this.baseRoot && this.baseRoot.rootId)) {
        const baseSnapshot = this.getSnapshot(normalizedRootId) || this.buildBaseSnapshot();
        this.focusedNodeId = '';
        this.focusPath = this.baseRoot ? [this.baseRoot] : [];
        this.activePathIds = this.baseRoot ? [this.baseRoot.rootId] : [];
        this.expandedNodeIds = [...this.topBranchIds];
        this.expandedWordRootIds =
          !this.topBranches.length &&
          baseSnapshot &&
          Array.isArray(baseSnapshot.words) &&
          baseSnapshot.words.length
            ? new Set([normalizedRootId])
            : new Set();
        this.cachedTreeModel = null; // 清除缓存
        this.activeWordCardId = '';
        this.lastTappedWordId = '';
        this.lastTappedWordAt = 0;
        this.$nextTick(() => {
          this.centerTreeNode('base-' + this.baseRoot.rootId);
          this.hasUserScrolledTree = false;
          this.scheduleDraw();
        });
        return;
      }
      const requestToken = this.beginRequest('branch');
      this.errorMsg = '';
      try {
        const snapshot = await this.fetchBranchSnapshot(
          normalizedRootId,
          {},
          { scope: 'branch', token: requestToken },
        );
        if (!snapshot || !this.isLatestRequest('branch', requestToken)) return;
        this.focusedNodeId = normalizedRootId;
        this.focusPath =
          Array.isArray(snapshot.path) && snapshot.path.length
            ? snapshot.path
            : this.baseRoot
              ? [this.baseRoot]
              : [];
        this.activePathIds = uniqueIds(this.focusPath.map((item) => item.rootId));
        this.expandedNodeIds = this.buildExpandedIds(this.activePathIds, normalizedRootId);
        this.expandedWordRootIds = new Set([...(this.expandedWordRootIds || []), normalizedRootId]);
        this.cachedTreeModel = null; // 清除缓存
        this.$nextTick(() => {
          this.ensureBranchVisible(normalizedRootId);
          this.scheduleDraw();
        });
      } catch (error) {
        if (!this.isLatestRequest('branch', requestToken)) return;
        this.errorMsg = this.formatRepoError(error);
      }
    },

    toggleTheme() {
      if (this.isLoading) return;
      this.closeSeedDropdown();
      this.currentTheme =
        this.currentTheme === 'theme-dark-zen' ? 'theme-clay-pastel' : 'theme-dark-zen';
      uni.setStorageSync('user_theme', this.currentTheme);
      this.scheduleDraw();
    },

    async handleTreeNodeTap(node) {
      if (!node) return;
      this.closeSeedDropdown();
      if (node.kind === 'base') {
        await this.openRoot(this.baseRoot ? this.baseRoot.rootId : this.currentSeed);
        return;
      }
      if (node.kind === 'word') {
        const word = node.data;
        if (!word) return;
        this.handleWordTap(word);
        return;
      }
      if (this.isRootNodeKind(node.kind)) {
        await this.toggleRootNode(node);
        return;
      }
    },

    playWordPronunciation(word) {
      if (!word) return;
      const pronunciationUrl = wordRepo.getWordPronunciationUrl(
        word.word || word.canonical || word.id,
      );
      if (!pronunciationUrl) {
        uni.showToast({ title: '暂无发音', icon: 'none' });
        return;
      }
      this.destroyAudioContext();
      this.audioPlayingWordId = word.id;
      const audio = uni.createInnerAudioContext();
      this.audioContext = audio;
      audio.src = pronunciationUrl;
      audio.onEnded(() => {
        if (this.audioContext === audio) this.audioContext = null;
        this.audioPlayingWordId = '';
        audio.destroy();
      });
      audio.onError(() => {
        if (this.audioContext === audio) this.audioContext = null;
        this.audioPlayingWordId = '';
        uni.showToast({ title: '发音加载失败', icon: 'none' });
        audio.destroy();
      });
      audio.play();
    },

    getSnapshot(rootId) {
      return this.branchSnapshots[normalizeText(rootId).toLowerCase()] || null;
    },

    shouldShowWords(rootId, snapshot) {
      const normalizedRootId = normalizeText(rootId).toLowerCase();
      // 根据expandedWordRootIds决定是否展开直属单词
      return Boolean(
        this.expandedWordRootIds.has(normalizedRootId) &&
        Array.isArray(snapshot && snapshot.words) &&
        snapshot.words.length,
      );
    },

    makeRootNode(rootSummary, side, depth, isTop) {
      const kind =
        rootSummary.type === 'section' || rootSummary.type === 'prefix'
          ? 'section'
          : rootSummary.type === 'branch'
            ? 'branch'
            : rootSummary.type === 'category'
              ? 'category'
              : 'root';
      const title = ellipsis(this.getRootDisplayName(rootSummary), depth > 2 ? 14 : 16);
      const subtitle = ellipsis(
        normalizeText(
          rootSummary.descriptionCn || rootSummary.meaning || getTypeLabel(rootSummary.type),
        ),
        depth > 2 ? 14 : 18,
      );
      const eyebrow = isTop
        ? 'L1 ' + getTypeLabel(rootSummary.type)
        : getTypeLabel(rootSummary.type);
      const badge = Number(rootSummary.descendantWordCount || rootSummary.wordCount || 0)
        ? String(Number(rootSummary.descendantWordCount || rootSummary.wordCount || 0)) + 'w'
        : '';
      const size = measureNodeSize(kind, title, subtitle, eyebrow, badge);
      return {
        id: 'root-' + rootSummary.rootId,
        kind,
        side,
        depth,
        width: size.width,
        height: size.height,
        title,
        subtitle,
        eyebrow,
        badge,
        data: rootSummary,
        isFocused: rootSummary.rootId === this.focusedNodeId,
        isPath: this.activePathIds.includes(rootSummary.rootId),
      };
    },
    makeWordNode(word, side, depth, ownerId) {
      const title = this.getWordDisplayName(word);
      const subtitle = '';
      const badge = word.status === wordRepo.STATUS_MASTERED ? '已掌握' : '';
      const size = measureNodeSize('word', title, subtitle, 'WORD', badge);
      return {
        id: 'word-' + word.id,
        kind: 'word',
        side,
        depth,
        width: size.width,
        height: size.height,
        title,
        subtitle,
        eyebrow: 'WORD',
        badge,
        data: word,
        ownerId,
        isFocused: false,
        isPath: false,
        isActiveWord: word.id === this.activeWordCardId,
      };
    },

    getGapBetween(previous, next) {
      const leafKinds = ['word'];
      if (
        leafKinds.includes(previous && previous.node && previous.node.kind) &&
        leafKinds.includes(next && next.node && next.node.kind)
      )
        return LAYOUT.leafGap;
      return LAYOUT.branchGap;
    },

    getStackHeight(items) {
      if (!items.length) return 0;
      return items.reduce((sum, item, index) => {
        const gap = index > 0 ? this.getGapBetween(items[index - 1], item) : 0;
        return sum + gap + item.subtreeHeight;
      }, 0);
    },

    getHorizontalGap(depth, kind) {
      const gapBase = depth <= 1 ? LAYOUT.trunkGapX : LAYOUT.depthGapX;
      return kind === 'word' ? gapBase - 6 : gapBase;
    },

    buildVisualTree(rootSummary, side, depth, isTop) {
      const node = this.makeRootNode(rootSummary, side, depth, isTop);
      const rootId = normalizeText(rootSummary.rootId).toLowerCase();
      const snapshot = this.getSnapshot(rootId);
      const isExpanded = Boolean(this.expandedNodeIds.includes(rootId));
      const childTrees = [];
      if (isExpanded && snapshot) {
        const childRoots = Array.isArray(snapshot.children) ? snapshot.children : [];
        childRoots.forEach((child) => {
          childTrees.push(this.buildVisualTree(child, side, depth + 1, false));
        });
        if (this.shouldShowWords(rootId, snapshot)) {
          const words = Array.isArray(snapshot.words) ? snapshot.words : [];
          words.forEach((word) => {
            const wordNode = this.makeWordNode(word, side, depth + 1, rootId);
            childTrees.push({ node: wordNode, children: [], subtreeHeight: wordNode.height });
          });
        }
      }
      const subtreeHeight = Math.max(node.height, this.getStackHeight(childTrees));
      return { node, children: childTrees, subtreeHeight };
    },

    placeTree(tree, x, y, side, parentNode, placedNodes, connections) {
      const currentNode = { ...tree.node, x: Math.round(x), y: Math.round(y) };
      placedNodes.push(currentNode);
      if (parentNode) {
        connections.push({
          from: parentNode.id,
          to: currentNode.id,
          side,
          tone:
            currentNode.isFocused || currentNode.isPath ? 'primary' : 'secondary',
        });
      }
      if (!tree.children.length) return;
      const stackHeight = this.getStackHeight(tree.children);
      let cursor = y - stackHeight / 2;
      tree.children.forEach((childTree, index) => {
        const childCenterY = cursor + childTree.subtreeHeight / 2;
        const gapX = this.getHorizontalGap(currentNode.depth, childTree.node.kind);
        const childX =
          side === 'right'
            ? x + currentNode.width / 2 + gapX + childTree.node.width / 2
            : x - currentNode.width / 2 - gapX - childTree.node.width / 2;
        this.placeTree(
          childTree,
          childX,
          childCenterY,
          side,
          currentNode,
          placedNodes,
          connections,
        );
        cursor += childTree.subtreeHeight;
        if (index < tree.children.length - 1)
          cursor += this.getGapBetween(childTree, tree.children[index + 1]);
      });
    },

    buildTreeModel() {
      // 缓存检查：如果依赖未改变，直接返回缓存结果
      const currentDeps = {
        expandedIds: this.expandedNodeIds?.join(','),
        expandedWordRootIds: Array.from(this.expandedWordRootIds || [])
          .sort()
          .join(','),
        focusPath: this.focusPath?.map((r) => r.rootId).join(','),
      };

      if (
        this.cachedTreeModel &&
        JSON.stringify(this.treeModelDeps) === JSON.stringify(currentDeps)
      ) {
        return this.cachedTreeModel;
      }

      if (!this.baseRoot)
        return {
          width: Math.max(320, this.viewportWidth || 320),
          height: LAYOUT.baseMinHeight,
          nodes: [],
          connections: [],
          baseNode: null,
        };
      const baseTitle = this.currentSeed.toUpperCase();
      const baseSubtitle = getTypeLabel(this.baseRoot.type);
      const baseSize = measureNodeSize('base', baseTitle, baseSubtitle, 'SEED');
      const baseNode = {
        id: 'base-' + this.baseRoot.rootId,
        kind: 'base',
        side: 'center',
        depth: 0,
        width: baseSize.width,
        height: baseSize.height,
        title: baseTitle,
        subtitle: baseSubtitle,
        eyebrow: 'SEED',
        badge: '',
        data: this.baseRoot,
        isFocused: !this.focusedNodeId,
        isPath: true,
        x: 0,
        y: 0,
      };
      const leftTrees = [];
      const rightTrees = [];
      this.topBranches.forEach((branch) => {
        const side = this.treeSideMap[branch.rootId] || branch.sideHint || 'left';
        const tree = this.buildVisualTree(branch, side, 1, true);
        if (side === 'right') rightTrees.push(tree);
        else leftTrees.push(tree);
      });
      if (!this.topBranches.length) {
        const baseSnapshot = this.baseSnapshot;
        const baseRootId = this.baseRoot && this.baseRoot.rootId;
        if (baseRootId && this.shouldShowWords(baseRootId, baseSnapshot)) {
          const baseWords = Array.isArray(baseSnapshot && baseSnapshot.words)
            ? baseSnapshot.words
            : [];
          baseWords.forEach((word, index) => {
            const side = index % 2 === 0 ? 'left' : 'right';
            const wordNode = this.makeWordNode(word, side, 1, baseRootId);
            const tree = { node: wordNode, children: [], subtreeHeight: wordNode.height };
            if (side === 'right') rightTrees.push(tree);
            else leftTrees.push(tree);
          });
        }
      }
      const placedNodes = [];
      const connections = [];
      const totalLeftHeight = this.getStackHeight(leftTrees);
      let leftCursor = -totalLeftHeight / 2;
      leftTrees.forEach((tree, index) => {
        const centerY = leftCursor + tree.subtreeHeight / 2;
        const x = -baseNode.width / 2 - LAYOUT.trunkGapX - tree.node.width / 2;
        this.placeTree(tree, x, centerY, 'left', baseNode, placedNodes, connections);
        leftCursor += tree.subtreeHeight;
        if (index < leftTrees.length - 1)
          leftCursor += this.getGapBetween(tree, leftTrees[index + 1]);
      });
      const totalRightHeight = this.getStackHeight(rightTrees);
      let rightCursor = -totalRightHeight / 2;
      rightTrees.forEach((tree, index) => {
        const centerY = rightCursor + tree.subtreeHeight / 2;
        const x = baseNode.width / 2 + LAYOUT.trunkGapX + tree.node.width / 2;
        this.placeTree(tree, x, centerY, 'right', baseNode, placedNodes, connections);
        rightCursor += tree.subtreeHeight;
        if (index < rightTrees.length - 1)
          rightCursor += this.getGapBetween(tree, rightTrees[index + 1]);
      });
      const allNodes = [baseNode, ...placedNodes];
      const bounds = allNodes.reduce(
        (acc, node) => ({
          minX: Math.min(acc.minX, node.x - node.width / 2),
          maxX: Math.max(acc.maxX, node.x + node.width / 2),
          minY: Math.min(acc.minY, node.y - node.height / 2),
          maxY: Math.max(acc.maxY, node.y + node.height / 2),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        },
      );
      const contentWidth = bounds.maxX - bounds.minX;
      const contentHeight = bounds.maxY - bounds.minY;
      const minStageWidth = Math.max(320, this.viewportWidth || 320);
      const stageWidth = Math.max(minStageWidth, contentWidth + LAYOUT.paddingX * 2);
      const stageHeight = Math.max(LAYOUT.baseMinHeight, contentHeight + LAYOUT.paddingY * 2);
      const dx =
        LAYOUT.paddingX +
        Math.max(0, -bounds.minX) +
        Math.max(0, (stageWidth - (contentWidth + LAYOUT.paddingX * 2)) / 2);
      const dy =
        LAYOUT.paddingY +
        Math.max(0, -bounds.minY) +
        Math.max(0, (stageHeight - (contentHeight + LAYOUT.paddingY * 2)) / 2);
      const shiftedNodes = allNodes.map((node) => ({
        ...node,
        x: Math.round(node.x + dx),
        y: Math.round(node.y + dy),
      }));
      const shiftedBaseNode = shiftedNodes.find((node) => node.id === baseNode.id) || null;
      const result = {
        width: Math.round(stageWidth),
        height: Math.round(stageHeight),
        nodes: shiftedNodes,
        connections,
        baseNode: shiftedBaseNode,
      };

      // 保存缓存
      this.cachedTreeModel = result;
      this.treeModelDeps = {
        expandedIds: this.expandedNodeIds?.join(','),
        expandedWordRootIds: Array.from(this.expandedWordRootIds || [])
          .sort()
          .join(','),
        focusPath: this.focusPath?.map((r) => r.rootId).join(','),
      };

      return result;
    },

    getNodeClasses(node) {
      return [
        'tree-node--' + node.kind,
        node.side === 'left' ? 'is-left' : '',
        node.side === 'right' ? 'is-right' : '',
        node.isPath ? 'is-path' : '',
        node.isFocused ? 'is-focused' : '',
        node.isActiveWord ? 'is-word-active' : '',
      ].filter(Boolean);
    },

    getNodeStyle(node) {
      const zIndex =
        node.kind === 'base'
          ? 4
          : node.kind === 'word'
            ? 2
            : 3;
      return {
        left: Math.round(node.x - node.width / 2) + 'px',
        top: Math.round(node.y - node.height / 2) + 'px',
        width: node.width + 'px',
        height: node.height + 'px',
        zIndex,
      };
    },

    syncViewport() {
      const query = uni.createSelectorQuery().in(this);
      query.select('.tree-viewport').boundingClientRect();
      query.exec((res) => {
        const rect = res && res[0];
        if (!rect) return;
        this.viewportWidth = Math.max(320, Math.round(rect.width || 320));
        this.viewportHeight = Math.max(360, Math.round(rect.height || 360));
        this.canvasContext = uni.createCanvasContext('mindTreeCanvas', this);
        this.$nextTick(() => {
          if (!this.hasInitialTreePositioned && this.baseRoot) {
            this.centerTreeNode('base-' + this.baseRoot.rootId, { animate: false });
            this.hasInitialTreePositioned = true;
          }
          this.scheduleDraw();
        });
      });
    },

    centerTreeNode(nodeId, options = {}) {
      const model = this.treeModel;
      const targetId = normalizeText(nodeId);
      const targetNode =
        (targetId && model.nodes.find((node) => node.id === targetId)) || model.baseNode || null;
      if (!targetNode) {
        this.setTreeScroll(0, 0, { animate: false });
        return;
      }
      this.setTreeScroll(targetNode.x - this.viewportWidth / 2, targetNode.y - this.viewportHeight / 2, options);
    },

    scheduleDraw() {
      // 防抖：合并多次状态变化为单次绘制
      if (this.drawTimer) clearTimeout(this.drawTimer);
      this.drawTimer = setTimeout(() => {
        this.drawTimer = null;
        this.draw();
      }, 32); // 约 30fps 的防抖间隔，足够流畅且不卡
    },

    draw() {
      const model = this.treeModel;
      if (!this.canvasContext || !model.nodes.length) return;
      const ctx = this.canvasContext;
      const nodeMap = model.nodes.reduce((acc, node) => {
        acc[node.id] = node;
        return acc;
      }, {});
      const lineColors = THEME_LINES[this.currentTheme] || THEME_LINES['theme-dark-zen'];
      ctx.clearRect(0, 0, model.width, model.height);
      model.connections.forEach((connection) => {
        const from = nodeMap[connection.from];
        const to = nodeMap[connection.to];
        if (!from || !to) return;
        const startX =
          connection.side === 'right' ? from.x + from.width / 2 - 2 : from.x - from.width / 2 + 2;
        const endX =
          connection.side === 'right' ? to.x - to.width / 2 + 2 : to.x + to.width / 2 - 2;
        const startY = from.y;
        const endY = to.y;
        const direction = connection.side === 'right' ? 1 : -1;
        const distance = Math.abs(endX - startX);
        const curve = Math.max(18, distance * 0.44);
        const cp1X = startX + curve * direction;
        const cp2X = endX - curve * direction;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1X, startY, cp2X, endY, endX, endY);
        if (connection.tone === 'tertiary') ctx.setLineDash([5, 5]);
        else ctx.setLineDash([]);
        ctx.setStrokeStyle(lineColors[connection.tone] || lineColors.secondary);
        ctx.setLineWidth(connection.tone === 'primary' ? 2.6 : 1.6);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.draw();
    },
  },
};
</script>

<style lang="scss">
.roots-page {
  min-height: 100vh;
  box-sizing: border-box;
}
.roots-shell {
  min-height: 100vh;
  padding: 36rpx 24rpx 48rpx;
  box-sizing: border-box;
}
.theme-dark-zen {
  background:
    radial-gradient(circle at 14% 6%, rgba(76, 147, 255, 0.16), transparent 32%),
    radial-gradient(circle at 84% 4%, rgba(255, 149, 117, 0.14), transparent 22%),
    linear-gradient(180deg, #07111f 0%, #09121a 54%, #050910 100%);
  color: #eef5ff;
}
.theme-clay-pastel {
  background:
    radial-gradient(circle at 14% 8%, rgba(105, 168, 228, 0.14), transparent 32%),
    radial-gradient(circle at 84% 4%, rgba(238, 154, 172, 0.12), transparent 22%),
    linear-gradient(180deg, #fbfdff 0%, #eef4fb 60%, #e6edf6 100%);
  color: #223648;
}
.page-header {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.mind-card__header,
.detail-card__header,
.word-list-card__header {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: flex-start;
}
.page-copy,
.mind-card__copy,
.detail-copy {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.page-kicker,
.mind-card__kicker,
.detail-kicker {
  font-size: 20rpx;
  letter-spacing: 4rpx;
  opacity: 0.72;
}
.page-title {
  font-size: 54rpx;
  font-weight: 700;
  line-height: 1.08;
}
.mind-card__title,
.detail-title {
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.08;
}
.page-description,
.mind-card__subtitle,
.detail-subtitle,
.word-list-card__subtitle {
  font-size: 22rpx;
  line-height: 1.54;
  opacity: 0.8;
}
.mind-card__subtitle {
  min-height: 68rpx;
  display: block;
}
.page-toolbar {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  position: relative;
  z-index: 20;
}
.seed-picker {
  flex: 1;
  min-height: 76rpx;
  border-radius: 24rpx;
  padding: 0 22rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.seed-picker__label {
  font-size: 20rpx;
  opacity: 0.72;
  letter-spacing: 1rpx;
}
.seed-picker__value {
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
}
.seed-picker__count {
  font-size: 20rpx;
  opacity: 0.78;
  margin-left: 4rpx;
}
.seed-picker__arrow {
  margin-left: auto;
  font-size: 18rpx;
  opacity: 0.62;
  transition: transform 0.18s ease;
}
.seed-picker.is-open .seed-picker__arrow {
  transform: rotate(180deg);
}
.seed-dropdown {
  margin-top: 14rpx;
  padding: 20rpx;
  border-radius: 28rpx;
  box-sizing: border-box;
}
.seed-dropdown__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 18rpx;
}
.seed-dropdown__title {
  font-size: 22rpx;
  font-weight: 700;
}
.seed-dropdown__meta {
  font-size: 18rpx;
  opacity: 0.64;
}
.seed-dropdown__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
}
.seed-dropdown__item {
  min-height: 86rpx;
  padding: 14rpx 12rpx;
  border-radius: 22rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8rpx;
}
.seed-dropdown__item-letter {
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
}
.seed-dropdown__item-count {
  font-size: 18rpx;
  opacity: 0.76;
}
.seed-dropdown__item.is-current {
  transform: translateY(-2rpx);
}
.seed-dropdown__item.is-disabled {
  opacity: 0.44;
}
.seed-dropdown__item.is-current .seed-dropdown__item-count {
  opacity: 0.9;
}
.theme-toggle {
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 700;
}
.theme-dark-zen .theme-toggle {
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
}
.theme-clay-pastel .theme-toggle {
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(54, 90, 132, 0.12);
}
.path-rail {
  margin-top: 26rpx;
  white-space: nowrap;
}
.path-track {
  display: inline-flex;
  gap: 14rpx;
  padding-right: 24rpx;
}
.path-pill,
.mind-stat,
.metric-chip,
.detail-action,
.ghost-button,
.sample-pill,
.tag-pill {
  border-radius: 22rpx;
  box-sizing: border-box;
}
.theme-dark-zen .seed-picker,
.theme-dark-zen .seed-dropdown,
.theme-dark-zen .mind-card,
.theme-dark-zen .detail-card,
.theme-dark-zen .loading-banner,
.theme-dark-zen .mind-stat,
.theme-dark-zen .path-pill,
.theme-dark-zen .metric-chip,
.theme-dark-zen .detail-action,
.theme-dark-zen .ghost-button,
.theme-dark-zen .sample-pill,
.theme-dark-zen .tag-pill {
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}
.theme-dark-zen .seed-dropdown__item {
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}
.theme-dark-zen .seed-dropdown__item.is-current {
  background: rgba(255, 126, 95, 0.16);
  border-color: rgba(255, 126, 95, 0.34);
}
.theme-clay-pastel .seed-picker,
.theme-clay-pastel .seed-dropdown,
.theme-clay-pastel .mind-card,
.theme-clay-pastel .detail-card,
.theme-clay-pastel .loading-banner,
.theme-clay-pastel .mind-stat,
.theme-clay-pastel .path-pill,
.theme-clay-pastel .metric-chip,
.theme-clay-pastel .detail-action,
.theme-clay-pastel .ghost-button,
.theme-clay-pastel .sample-pill,
.theme-clay-pastel .tag-pill {
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(72, 103, 138, 0.1);
}
.theme-clay-pastel .seed-dropdown__item {
  background: rgba(247, 244, 238, 0.88);
  border: 1rpx solid rgba(72, 103, 138, 0.08);
}
.theme-clay-pastel .seed-dropdown__item.is-current {
  background: rgba(255, 126, 95, 0.12);
  border-color: rgba(235, 104, 74, 0.24);
}
.theme-dark-zen .path-pill.is-current {
  background: rgba(255, 126, 95, 0.16);
  border-color: rgba(255, 126, 95, 0.34);
}
.theme-clay-pastel .path-pill.is-current {
  background: rgba(255, 126, 95, 0.12);
  border-color: rgba(235, 104, 74, 0.24);
}
.seed-picker.is-disabled,
.theme-toggle.is-disabled {
  opacity: 0.5;
}
@media (max-width: 520px) {
  .seed-dropdown__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.loading-banner,
.error-banner,
.mind-card,
.detail-card {
  margin-top: 22rpx;
  padding: 24rpx;
  border-radius: 32rpx;
  box-sizing: border-box;
}
.theme-dark-zen .error-banner {
  background: rgba(146, 46, 67, 0.92);
  border: 1rpx solid rgba(255, 214, 221, 0.2);
  color: #fff4f5;
}
.theme-clay-pastel .error-banner {
  background: rgba(250, 225, 230, 0.96);
  border: 1rpx solid rgba(176, 74, 96, 0.14);
  color: #7d3143;
}
.mind-stats,
.metric-row,
.tag-row,
.sample-list {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}
.mind-stat,
.metric-chip {
  padding: 16rpx 18rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.mind-stat__value,
.metric-chip__value {
  font-size: 26rpx;
  font-weight: 700;
}
.mind-stat__label,
.metric-chip__label {
  font-size: 18rpx;
  opacity: 0.7;
}
.mind-hint,
.word-list-empty {
  margin-top: 20rpx;
  font-size: 22rpx;
  line-height: 1.56;
  opacity: 0.78;
}
.mind-hint {
  min-height: 34rpx;
}
.tree-viewport {
  margin-top: 22rpx;
  width: 100%;
  height: 72vh;
  min-height: 760rpx;
  overflow: hidden;
}
.tree-scroll {
  width: 100%;
  height: 100%;
  white-space: nowrap;
}
.tree-stage {
  position: relative;
  display: inline-block;
  min-width: 100%;
  min-height: 100%;
}
.tree-canvas,
.tree-node-layer {
  position: absolute;
  inset: 0;
}
.tree-canvas {
  pointer-events: none;
}
.tree-node-layer {
  pointer-events: none;
}
.word-card-node {
  position: absolute;
  pointer-events: auto;
  z-index: 10;
  animation: slideUp 0.3s ease-out;
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.word-card {
  width: 100%;
  padding: 20rpx;
  border-radius: 20rpx;
  min-width: 200rpx;
  max-width: 320rpx;
  box-sizing: border-box;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.theme-dark-zen .word-card {
  background: rgba(255, 255, 255, 0.12);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  color: #eef5ff;
}
.theme-clay-pastel .word-card {
  background: rgba(255, 255, 255, 0.88);
  border: 1rpx solid rgba(72, 103, 138, 0.12);
  color: #223648;
}
.word-card__close {
  position: absolute;
  top: 8rpx;
  right: 12rpx;
  font-size: 32rpx;
  cursor: pointer;
  opacity: 0.6;
}
.word-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8rpx;
  margin-bottom: 12rpx;
}
.word-card__word {
  font-size: 28rpx;
  font-weight: 700;
}
.word-card__status {
  font-size: 16rpx;
  padding: 4rpx 8rpx;
  border-radius: 8rpx;
  white-space: nowrap;
}
.theme-dark-zen .word-card__status {
  background: rgba(255, 126, 95, 0.24);
  color: rgba(255, 180, 140, 0.96);
}
.theme-clay-pastel .word-card__status {
  background: rgba(255, 126, 95, 0.12);
  color: rgba(200, 80, 60, 0.96);
}
.word-card__phonetic {
  font-size: 18rpx;
  opacity: 0.76;
  margin-bottom: 8rpx;
  display: block;
}
.word-card__translation {
  font-size: 20rpx;
  line-height: 1.48;
  margin-bottom: 12rpx;
  display: block;
}
.word-card__sentence {
  font-size: 18rpx;
  line-height: 1.56;
  opacity: 0.78;
  display: block;
}
.word-card__actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}
.word-card__button {
  flex: 1;
  min-height: 56rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18rpx;
}
.theme-dark-zen .word-card__button {
  background: rgba(255, 255, 255, 0.08);
  color: #eef5ff;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}
.theme-dark-zen .word-card__button--primary {
  background: rgba(255, 126, 95, 0.18);
  color: #ffd0c2;
  border-color: rgba(255, 126, 95, 0.24);
}
.theme-clay-pastel .word-card__button {
  background: rgba(72, 103, 138, 0.08);
  color: #223648;
  border: 1rpx solid rgba(72, 103, 138, 0.08);
}
.theme-clay-pastel .word-card__button--primary {
  background: rgba(255, 126, 95, 0.14);
  color: #b24d38;
  border-color: rgba(255, 126, 95, 0.2);
}
.word-card.is-playing {
  animation: pulse 0.6s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
.tree-node {
  position: absolute;
  box-sizing: border-box;
  border-radius: 16rpx;
  padding: 8rpx 10rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2rpx;
  pointer-events: auto;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    opacity 180ms ease;
}
.tree-node.is-left {
  text-align: right;
  align-items: flex-end;
}
.tree-node.is-right,
.tree-node--base {
  text-align: left;
  align-items: flex-start;
}
.tree-node__eyebrow {
  font-size: 14rpx;
  letter-spacing: 1rpx;
  opacity: 0.6;
}
.tree-node__title {
  font-size: 20rpx;
  line-height: 1.1;
  font-weight: 700;
}
.tree-node__subtitle {
  font-size: 16rpx;
  line-height: 1.2;
  opacity: 0.76;
}
.tree-node__badge {
  font-size: 14rpx;
  opacity: 0.66;
}
.theme-dark-zen .tree-node--base,
.theme-clay-pastel .tree-node--base {
  background: linear-gradient(135deg, rgba(255, 100, 106, 0.94), rgba(255, 126, 95, 0.88));
  color: #fff8f4;
}
.theme-dark-zen .tree-node--section {
  background: rgba(255, 146, 92, 0.2);
  border: 1rpx solid rgba(255, 158, 112, 0.34);
}
.theme-clay-pastel .tree-node--section {
  background: rgba(255, 148, 104, 0.14);
  border: 1rpx solid rgba(240, 136, 92, 0.26);
}
.theme-dark-zen .tree-node--root,
.theme-dark-zen .tree-node--branch,
.theme-dark-zen .tree-node--category {
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.12);
}
.theme-clay-pastel .tree-node--root,
.theme-clay-pastel .tree-node--branch,
.theme-clay-pastel .tree-node--category {
  background: rgba(255, 255, 255, 0.94);
  border: 1rpx solid rgba(72, 103, 138, 0.12);
}
.theme-dark-zen .tree-node--word {
  background: rgba(244, 247, 251, 0.96);
  border: 1rpx solid rgba(222, 231, 247, 0.8);
  color: #1d2b39;
  animation: wordNodeFadeIn 180ms ease;
}
.theme-clay-pastel .tree-node--word {
  background: rgba(255, 255, 255, 0.96);
  border: 1rpx solid rgba(88, 112, 138, 0.16);
  animation: wordNodeFadeIn 180ms ease;
}
.tree-node.is-path,
.tree-node.is-focused,
.tree-node.is-word-active {
  transform: translateY(-2rpx);
}
@keyframes wordNodeFadeIn {
  from {
    opacity: 0;
    transform: translateY(8rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.tree-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  opacity: 0.72;
}
.detail-actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}
.metric-row,
.content-block,
.sample-row,
.word-list-card {
  margin-top: 22rpx;
}
.content-block {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.content-block__title,
.sample-row__label,
.word-list-card__title {
  font-size: 24rpx;
  font-weight: 700;
}
.content-block__body {
  font-size: 24rpx;
  line-height: 1.66;
  opacity: 0.86;
}
.word-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 20rpx;
}
.word-row {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  box-sizing: border-box;
}
.theme-dark-zen .word-row {
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}
.theme-clay-pastel .word-row {
  background: rgba(255, 255, 255, 0.72);
  border: 1rpx solid rgba(72, 103, 138, 0.08);
}
.theme-dark-zen .word-row.is-active {
  background: rgba(255, 126, 95, 0.12);
  border-color: rgba(255, 126, 95, 0.28);
}
.theme-clay-pastel .word-row.is-active {
  background: rgba(255, 126, 95, 0.1);
  border-color: rgba(235, 104, 74, 0.22);
}
.word-row__main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  flex: 1;
  min-width: 0;
}
.word-row__word {
  font-size: 26rpx;
  font-weight: 700;
}
.word-row__translation {
  font-size: 22rpx;
  opacity: 0.78;
  line-height: 1.44;
}
.word-row__status {
  font-size: 20rpx;
  opacity: 0.72;
  flex-shrink: 0;
}
</style>
