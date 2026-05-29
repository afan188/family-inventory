// pages/category/category.js
const app = getApp();
const { CATEGORIES } = require('../../utils/categories');
const { formatDate } = require('../../utils/formatters');

Page({
  data: { catId: '', catName: '', catIcon: '', catColor: '', items: [], totalValue_str: '0.00' },

  onLoad(options) {
    const id = options.id || 'other';
    this.setData({ catId: id });
    const cat = CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
    this.setData({ catName: cat.name, catIcon: cat.icon, catColor: cat.color });
    this.loadItems();
  },

  onShow() {
    this.loadItems();
  },

  loadItems() {
    const items = app.globalData.items
      .filter(i => i.category === this.data.catId)
      .map(item => ({
        ...item,
        price_str: (parseFloat(item.price) || 0).toLocaleString('zh-CN', {
          minimumFractionDigits: 2, maximumFractionDigits: 2
        }),
        date_str: formatDate(item.purchaseDate)
      }))
      .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));

    const total = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
    this.setData({ items, totalValue_str: total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/item-detail/item-detail?id=${e.currentTarget.dataset.id}` });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/item-add/item-add' });
  }
});
