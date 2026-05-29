// pages/home/home.js
const app = getApp();
const { CATEGORIES } = require('../../utils/categories');
const { formatMoney, dateDiff } = require('../../utils/formatters');

Page({
  data: {
    stats: { total: 0, totalValue: 0, totalValue_str: '0.00', thisMonth: 0 },
    recentItems: [],
    categories: [],
    today: '',
    greeting: ''
  },

  onLoad() {
    this.initGreeting();
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  initGreeting() {
    const now = new Date();
    const h = now.getHours();
    const date = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    let greeting = '晚上好';
    if (h >= 5 && h < 12) greeting = '早上好';
    else if (h >= 12 && h < 18) greeting = '下午好';
    this.setData({ today: date, greeting });
  },

  loadData() {
    const appData = app.globalData;
    app.refreshStats();

    const items = appData.items;
    const stats = appData.stats;
    const categories = CATEGORIES;

    // 格式化统计数据
    stats.totalValue_str = (stats.totalValue || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    // 最近添加（倒序，取最新5条）
    const recent = [...items]
      .sort((a, b) => {
        const da = a.purchaseDate ? new Date(a.purchaseDate) : 0;
        const db = b.purchaseDate ? new Date(b.purchaseDate) : 0;
        return db - da;
      })
      .slice(0, 5)
      .map(item => {
        const cat = categories.find(c => c.id === item.category) || categories[categories.length - 1];
        return {
          ...item,
          category_name: cat.name,
          category_icon: cat.icon,
          category_color: cat.color,
          dateDiff: dateDiff(item.purchaseDate),
          price_str: (parseFloat(item.price) || 0).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        };
      });

    // 分类带数量
    const catsWithCount = categories.map(cat => ({
      ...cat,
      count: items.filter(i => i.category === cat.id).length
    }));

    this.setData({ stats, recentItems: recent, categories: catsWithCount });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/item-add/item-add' });
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/item-detail/item-detail?id=${e.currentTarget.dataset.id}` });
  },

  goBrowse() {
    wx.switchTab({ url: '/pages/browse/browse' });
  },

  goCategory(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/category/category?id=${id}` });
  }
});
