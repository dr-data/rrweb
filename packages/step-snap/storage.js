// shared module - CRUD helpers for guides in chrome.storage.local
const STORAGE_KEY = 'guides';

export async function getGuides() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

export async function saveGuide(guide) {
  const guides = await getGuides();
  guides.push(guide);
  await chrome.storage.local.set({ [STORAGE_KEY]: guides });
  await checkStorageWarning();
}

export async function getGuide(id) {
  const guides = await getGuides();
  return guides.find(g => g.id === id);
}

export async function updateGuide(id, partial) {
  const guides = await getGuides();
  const index = guides.findIndex(g => g.id === id);
  if (index !== -1) {
    guides[index] = { ...guides[index], ...partial, updatedAt: Date.now() };
    await chrome.storage.local.set({ [STORAGE_KEY]: guides });
    await checkStorageWarning();
  }
}

export async function deleteGuide(id) {
  let guides = await getGuides();
  guides = guides.filter(g => g.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: guides });
}

export async function checkStorageWarning() {
  if (chrome.storage && chrome.storage.local && chrome.storage.local.getBytesInUse) {
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    if (bytesInUse > 4 * 1024 * 1024) { // 4MB
      chrome.runtime.sendMessage({ type: 'STORAGE_WARNING', bytesInUse });
    }
  }
}
