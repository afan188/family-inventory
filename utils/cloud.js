// utils/cloud.js - 云同步管理器
const Storage = require('./storage');

// 预置云环境 ID（开通云开发后填入）
const DEFAULT_CLOUD_ENV = 'cloud1-8gndjspe6b759566';

const CLOUD_ENV_KEY = 'family_inventory_cloud_env';
const SYNC_TIME_KEY = 'family_inventory_last_sync';

let cloudReady = false;
let syncing = false;
let db = null;

/**
 * 初始化云开发
 */
function init() {
  // 优先用用户手动配置的，否则用预置的
  const envId = wx.getStorageSync(CLOUD_ENV_KEY) || DEFAULT_CLOUD_ENV;
  if (!envId) {
    console.log('[Cloud] 未配置云环境ID，使用本地存储');
    return Promise.resolve(false);
  }
  if (!wx.cloud) {
    console.warn('[Cloud] 当前微信版本不支持云开发');
    return Promise.resolve(false);
  }
  try {
    wx.cloud.init({ env: envId, traceUser: true });
    db = wx.cloud.database();
    cloudReady = true;
    console.log('[Cloud] 初始化成功, env:', envId);
    return Promise.resolve(true);
  } catch (e) {
    console.error('[Cloud] 初始化失败:', e);
    cloudReady = false;
    return Promise.resolve(false);
  }
}

/**
 * 设置云环境 ID（设置页调用）
 */
function setEnvId(envId) {
  if (!envId) {
    wx.removeStorageSync(CLOUD_ENV_KEY);
    cloudReady = false;
    return true;
  }
  wx.setStorageSync(CLOUD_ENV_KEY, envId);
  cloudReady = false; // wx.cloud.init 只能调一次，需重启小程序才生效
  return true;
}

function getEnvId() {
  return wx.getStorageSync(CLOUD_ENV_KEY) || '';
}

function isReady() {
  return cloudReady;
}

function isSyncing() {
  return syncing;
}

function getLastSyncTime() {
  return wx.getStorageSync(SYNC_TIME_KEY) || 0;
}

/**
 * 从云端拉取物品列表
 */
async function pullItems() {
  if (!cloudReady) return null;
  try {
    // 云数据库每次最多取 20 条，需要分页
    let allData = [];
    let batch = 0;
    const MAX_BATCH = 50; // 安全上限
    while (batch < MAX_BATCH) {
      const { data } = await db.collection('items')
        .skip(batch * 20)
        .limit(20)
        .get();
      allData = allData.concat(data);
      if (data.length < 20) break;
      batch++;
    }
    return allData;
  } catch (e) {
    console.error('[Cloud] 拉取物品失败:', e);
    return null;
  }
}

/**
 * 从云端拉取用户设置（分类、频率）
 */
async function pullSettings() {
  if (!cloudReady) return null;
  try {
    const { data } = await db.collection('user_settings').limit(1).get();
    return data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error('[Cloud] 拉取设置失败:', e);
    return null;
  }
}

/**
 * 推送单个物品到云端（upsert）
 */
async function pushItem(item) {
  if (!cloudReady) return false;
  try {
    const docId = String(item.id);
    const { id, ...data } = item;
    data.updatedAt = db.serverDate();
    await db.collection('items').doc(docId).set({ data });
    return true;
  } catch (e) {
    console.error('[Cloud] 推送物品失败:', e);
    return false;
  }
}

/**
 * 从云端删除物品
 */
async function removeItem(id) {
  if (!cloudReady) return false;
  try {
    await db.collection('items').doc(String(id)).remove();
    return true;
  } catch (e) {
    console.error('[Cloud] 删除云端物品失败:', e);
    return false;
  }
}

/**
 * 推送用户设置到云端（upsert）
 */
async function pushSettings(categories, frequency) {
  if (!cloudReady) return false;
  try {
    const data = {
      categories: categories || [],
      frequency: frequency || {},
      updatedAt: db.serverDate()
    };
    const existing = await pullSettings();
    if (existing && existing._id) {
      await db.collection('user_settings').doc(existing._id).update({ data });
    } else {
      await db.collection('user_settings').add({ data });
    }
    return true;
  } catch (e) {
    console.error('[Cloud] 推送设置失败:', e);
    return false;
  }
}

/**
 * 全量同步：合并本地和云端数据
 * 策略：updatedAt 最新者胜出
 */
async function syncAll(localItems, localCategories, localFrequency) {
  if (!cloudReady || syncing) {
    return { items: localItems, categories: localCategories, frequency: localFrequency, synced: false };
  }
  syncing = true;

  try {
    // 1. 拉取云端数据
    const cloudItems = await pullItems();
    const cloudSettings = await pullSettings();

    // 2. 云端为空（首次使用云同步）：推送本地全部数据
    if ((!cloudItems || cloudItems.length === 0) && !cloudSettings) {
      console.log('[Cloud] 云端为空，推送本地数据');
      await pushAllItems(localItems);
      await pushSettings(localCategories, localFrequency);
      wx.setStorageSync(SYNC_TIME_KEY, Date.now());
      return { items: localItems, categories: localCategories, frequency: localFrequency, synced: true };
    }

    // 3. 合并物品
    let mergedItems = localItems;
    if (cloudItems && cloudItems.length > 0) {
      mergedItems = mergeItems(localItems, cloudItems);
    }

    // 4. 合并分类（云端优先，补充本地自定义分类）
    let mergedCategories = localCategories;
    let mergedFrequency = localFrequency;
    if (cloudSettings) {
      if (cloudSettings.categories && cloudSettings.categories.length > 0) {
        const localCustomCats = localCategories.filter(c => !isDefaultCategory(c));
        const cloudCatIds = new Set(cloudSettings.categories.map(c => c.id));
        mergedCategories = [...cloudSettings.categories];
        localCustomCats.forEach(c => {
          if (!cloudCatIds.has(c.id)) mergedCategories.push(c);
        });
      }
      if (cloudSettings.frequency) {
        mergedFrequency = cloudSettings.frequency;
      }
    }

    // 5. 保存合并结果到本地
    Storage.setItems(mergedItems);
    Storage.setCategories(mergedCategories);
    if (mergedFrequency) Storage.setFrequency(mergedFrequency);

    // 6. 推送合并结果到云端
    await pushAllItems(mergedItems);
    await pushSettings(mergedCategories, mergedFrequency);

    // 7. 更新同步时间
    wx.setStorageSync(SYNC_TIME_KEY, Date.now());

    console.log('[Cloud] 同步完成, 物品:', mergedItems.length);
    return { items: mergedItems, categories: mergedCategories, frequency: mergedFrequency, synced: true };
  } catch (e) {
    console.error('[Cloud] 全量同步失败:', e);
    return { items: localItems, categories: localCategories, frequency: localFrequency, synced: false };
  } finally {
    syncing = false;
  }
}

/**
 * 合并本地和云端物品
 * 规则：相同 id 取 updatedAt 最新；仅在一方的直接合并
 */
function mergeItems(localItems, cloudItems) {
  const localMap = {};
  localItems.forEach(item => { localMap[String(item.id)] = item; });

  const cloudMap = {};
  cloudItems.forEach(doc => {
    const id = doc._id;
    const clean = { ...doc, id: Number(id) || id };
    delete clean._id;
    delete clean._openid;
    cloudMap[id] = clean;
  });

  const allIds = new Set([...Object.keys(localMap), ...Object.keys(cloudMap)]);
  const merged = [];

  for (const id of allIds) {
    const local = localMap[id];
    const cloud = cloudMap[id];

    if (local && !cloud) {
      // 仅在本地
      merged.push(local);
    } else if (!local && cloud) {
      // 仅在云端
      merged.push(cloud);
    } else {
      // 两端都有：比较 updatedAt
      const lt = local.updatedAt || local.createdAt || 0;
      const ct = cloud.updatedAt || cloud.createdAt || 0;
      merged.push(ct > lt ? cloud : local);
    }
  }

  return merged;
}

/**
 * 推送所有物品到云端（全量覆盖）
 */
async function pushAllItems(items) {
  if (!cloudReady) return false;
  try {
    // 获取云端现有文档 ID 列表
    const existing = await pullItems();
    const existingIds = new Set((existing || []).map(d => d._id));
    const pushedIds = new Set();

    // 逐个 upsert
    for (const item of items) {
      const docId = String(item.id);
      const { id, ...data } = item;
      data.updatedAt = db.serverDate();
      try {
        await db.collection('items').doc(docId).set({ data });
      } catch (e) {
        // 文档可能不存在，用 add
        try {
          await db.collection('items').doc(docId).set({ data });
        } catch (e2) {
          console.error('[Cloud] 写入物品失败:', docId, e2);
        }
      }
      pushedIds.add(docId);
    }

    // 删除云端有但本地已删除的
    for (const doc of (existing || [])) {
      if (!pushedIds.has(doc._id)) {
        try { await db.collection('items').doc(doc._id).remove(); } catch (e) { }
      }
    }

    return true;
  } catch (e) {
    console.error('[Cloud] 推送全部物品失败:', e);
    return false;
  }
}

/**
 * 判断是否为默认分类
 */
function isDefaultCategory(cat) {
  const defaultIds = ['clothing', 'shoes', 'electronics', 'kitchen', 'furniture', 'food', 'books', 'sports', 'beauty', 'toys', 'other'];
  return defaultIds.includes(cat.id);
}

module.exports = {
  init,
  setEnvId,
  getEnvId,
  isReady,
  isSyncing,
  getLastSyncTime,
  pullItems,
  pushItem,
  removeItem,
  pushSettings,
  syncAll,
  pushAllItems
};
