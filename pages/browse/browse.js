// pages/browse/browse.js
const app = getApp();
const { CATEGORIES } = require('../../utils/categories');
const { dateDiff } = require('../../utils/formatters');

Page({
  data: {
    categories: [],
    activeCat: 'all',
    displayItems: [],
    sortKey: 'date',
    sortOptions: [
      { key: 'date', label: '时间' },
      { key: 'price', label: '价格' },
      { key: 'name', label: '名称' }
    ]
  },

  onLoad() {
    const cats = CATEGORIES.map(c => ({ ...c, count: 0 }));
    this.setData({ 
      categories: [{ id: 'all', name: '全部', icon: '📦', color: '#7A7A6A', count: 0 }, ...cats]
    });
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const appData = app.globalData;
    app.refreshStats();
    const items = appData.items;
    const stats = appData.stats;

    // 更新分类计数
    const cats = this.data.categories.map(c => {
      if (c.id === 'all') {
        return { ...c, count: items.length };
      }
      return { ...c, count: stats.byCategory[c.id] || 0 };
    });
    this.setData({ categories: cats });

    this.filterAndSort();
  },

  switchCat(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ activeCat: id });
    this.filterAndSort();
  },

  setSort(e) {
    this.setData({ sortKey: e.currentTarget.dataset.key });
    this.filterAndSort();
  },

  filterAndSort() {
    const { activeCat, sortKey } = this.data;
    const items = app.globalData.items;
    const categories = CATEGORIES;

    let filtered = activeCat === 'all'
      ? [...items]
      : items.filter(i => i.category === activeCat);

    filtered = filtered.map(item => {
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

    // 排序
    if (sortKey === 'date') {
      filtered.sort((a, b) => {
        const da = a.purchaseDate ? new Date(a.purchaseDate) : 0;
        const db = b.purchaseDate ? new Date(b.purchaseDate) : 0;
        return db - da;
      });
    } else if (sortKey === 'price') {
      filtered.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    } else if (sortKey === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    }

    this.setData({ displayItems: filtered });
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/item-detail/item-detail?id=${e.currentTarget.dataset.id}` });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/item-add/item-add' });
  },

  goManage() {
    wx.navigateTo({ url: '/pages/category-manage/category-manage' });
  }
});
