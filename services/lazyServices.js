let wordRepoPromise = null;
let progressSyncServicePromise = null;
let vibesRepoPromise = null;
let vibesEntryStatePromise = null;

function extractDefault(moduleValue) {
  const firstDefault = moduleValue && moduleValue.default ? moduleValue.default : moduleValue;
  return firstDefault && firstDefault.default ? firstDefault.default : firstDefault;
}

export function getWordRepo() {
  if (!wordRepoPromise) {
    wordRepoPromise = import('./wordRepo.js').then(extractDefault);
  }
  return wordRepoPromise;
}

export function getProgressSyncService() {
  if (!progressSyncServicePromise) {
    progressSyncServicePromise = import('./progressSyncService.js').then(extractDefault);
  }
  return progressSyncServicePromise;
}

export function getVibesRepo() {
  if (!vibesRepoPromise) {
    vibesRepoPromise = import('./vibesRepo.js').then(extractDefault);
  }
  return vibesRepoPromise;
}

export function getVibesEntryState() {
  if (!vibesEntryStatePromise) {
    vibesEntryStatePromise = import('./vibesEntryState.js').then(extractDefault);
  }
  return vibesEntryStatePromise;
}
