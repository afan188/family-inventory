// pages/search/search.js
const app = getApp();
const { CATEGORIES } = require('../../utils/categories');
const { dateDiff } = require('../../utils/formatters');

Page({
  data: {
    keyword: '',
    results: [],
    history: [],
    categories: [],
    recentItems: [],
    loading: false
  },

  onLoad() {
    const history = wx.getStorageSync('search_history') || [];
    this.setData({
      history: history.slice(0, 10),
      categories: CATEGORIES.slice(0, 6)
    });
    this.loadRecent();
  },

  onShow() {
    this.loadRecent();
  },

  loadRecent() {
    const items = app.globalData.items.slice(0, 20).map(item => {
      const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];
      return { ...item, category_icon: cat.icon, category_color: cat.color, category_name: cat.name };
    });
    this.setData({ recentItems: items });
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
    if (e.detail.value.length > 0) {
      this.doSearch();
    } else {
      this.setData({ results: [] });
    }
  },

  doSearch() {
    const kw = this.data.keyword.trim().toLowerCase();
    if (!kw) return;

    let history = this.data.history;
    history = [kw, ...history.filter(h => h !== kw)].slice(0, 10);
    wx.setStorageSync('search_history', history);
    this.setData({ history });

    const items = app.globalData.items;
    const results = items
      .filter(item => {
        const name = (item.name || '').toLowerCase();
        const brandModel = (item.brandModel || '').toLowerCase();
        const specs = item.specs || {};
        const tags = (item.tags || []).join(' ').toLowerCase();
        const channel = (item.channel || '').toLowerCase();
        const remark = (item.remark || '').toLowerCase();
        return name.includes(kw) || brandModel.includes(kw) || tags.includes(kw) ||
               channel.includes(kw) || remark.includes(kw) ||
               (specs.brand || '').toLowerCase().includes(kw) ||
               (specs.model || '').toLowerCase().includes(kw);
      })
      .map(item => {
        const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];
        return {
          ...item,
          category_name: cat.name,
          category_icon: cat.icon,
          category_color: cat.color,
          price_str: (parseFloat(item.price) || 0).toLocaleString('zh-CN', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
          })
        };
      });

    this.setData({ results });
  },

  clearSearch() {
    this.setData({ keyword: '', results: [] });
  },

  clearHistory() {
    wx.removeStorageSync('search_history');
    this.setData({ history: [] });
  },

  useHistory(e) {
    const word = e.currentTarget.dataset.word;
    this.setData({ keyword: word });
    this.doSearch();
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/item-detail/item-detail?id=${e.currentTarget.dataset.id}` });
  },

  goCategory(e) {
    wx.navigateTo({ url: `/pages/category/category?id=${e.currentTarget.dataset.id}` });
  }
});
