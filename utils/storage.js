// utils/storage.js - 数据持久化工具
const ITEMS_KEY = 'family_inventory_items';
const CATEGORIES_KEY = 'family_inventory_categories';
const FREQ_KEY = 'family_inventory_frequency';

// 顶层 require：小程序不允许函数体内 require
const { CATEGORIES } = require('./categories');

function init() {
  try {
    wx.getStorageInfoSync();
  } catch (e) {
    console.error('Storage init error:', e);
  }
}

function getItems() {
  try {
    const data = wx.getStorageSync(ITEMS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function setItems(items) {
  try {
    wx.setStorageSync(ITEMS_KEY, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error('Set items error:', e);
    return false;
  }
}

function getCategories() {
  try {
    const data = wx.getStorageSync(CATEGORIES_KEY);
    if (data) return JSON.parse(data);
    // 默认分类：与 categories.js 的 CATEGORIES 保持一致
    setCategories(CATEGORIES);
    return CATEGORIES;
  } catch (e) {
    return CATEGORIES || [];
  }
}

function setCategories(categories) {
  try {
    wx.setStorageSync(CATEGORIES_KEY, JSON.stringify(categories));
    return true;
  } catch (e) {
    return false;
  }
}

function getFrequency() {
  try {
    const data = wx.getStorageSync(FREQ_KEY);
    if (data) return JSON.parse(data);
    return null;
  } catch (e) {
    return null;
  }
}

function setFrequency(freq) {
  try {
    wx.setStorageSync(FREQ_KEY, JSON.stringify(freq));
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  init,
  getItems,
  setItems,
  getCategories,
  setCategories,
  getFrequency,
  setFrequency
};
