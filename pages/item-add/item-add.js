// pages/item-add/item-add.js
const app = getApp();
const Storage = require('../../utils/storage');
const Cloud = require('../../utils/cloud');
const { genId } = require('../../utils/formatters');
const { CATEGORIES, SIZE_OPTIONS, CHANNEL_PRESETS } = require('../../utils/categories');

// 按频率排序，返回 top N 的 id
function topByFreq(freqMap, n = 5) {
  if (!freqMap || typeof freqMap !== 'object') return [];
  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

// 根据名称关键词智能推荐分类
function recommendCategory(name) {
  const kw = name.toLowerCase();
  const map = {
    electronics: ['手机', '电脑', '平板', '耳机', '音箱', '相机', '手表', '充电器', '数据线', '键盘', '鼠标', '显示器', '电视', 'switch', '游戏机', 'iphone', 'ipad', 'mac', 'airpod'],
    furniture: ['床', '沙发', '椅子', '桌子', '柜子', '书柜', '衣柜', '书架', '茶几', '床头柜', '床垫', '窗帘', '灯', '吸尘器', '扫地机', '洗衣机', '冰箱', '空调'],
    clothing: ['衣', '裤子', '裙子', '衬衫', 'T恤', '外套', '大衣', '毛衣', '卫衣', '袜子', '内衣', '保暖', '优衣库', '无印良品', 'zara', 'h&m'],
    shoes: ['鞋', '靴', '运动鞋', '休闲鞋', '皮鞋', '凉鞋', '拖鞋', 'nike', 'adidas', 'nb', 'newbalance', 'aj', '椰子', 'vans', '匡威', '回力'],
    cosmetics: ['护肤', '化妆品', '口红', '粉底', '眼影', '面霜', '精华', '洗面奶', '防晒', '沐浴', '洗发', '护发', '香水'],
    books: ['书', '本子', '笔', '笔记本', '文具', '钢笔', '马克笔', '橡皮', '尺子'],
    sports: ['球', '瑜伽', '跑步', '健身', '哑铃', '自行车', '帐篷', '背包', '登山', '泳镜', '泳衣', '滑板'],
    food: ['零食', '饮料', '茶叶', '咖啡', '牛奶', '酸奶', '水果', '坚果', '巧克力', '饼干'],
  };
  for (const [cat, keywords] of Object.entries(map)) {
    if (keywords.some(k => kw.includes(k))) return cat;
  }
  return null;
}

// 从已有物品中提取所有标签
function getAvailableTags() {
  const items = app.globalData.items || [];
  const tagSet = new Set(['常用', '贵重', '家用', '收藏', '消耗品', '备用']);
  items.forEach(i => (i.tags || []).forEach(t => tagSet.add(t)));
  return Array.from(tagSet);
}

// 尺码选项映射
function getClothesOptions(gender) {
  const key = gender === '男款' ? 'men' : 'women';
  return SIZE_OPTIONS.clothes[key] || [];
}
function getShoesOptions(type, gender) {
  if (type === '欧码') return SIZE_OPTIONS.shoes.eu || [];
  if (type === '国际码') return SIZE_OPTIONS.shoes.us || [];
  // 中国码：按性别
  return gender === '男款' ? (SIZE_OPTIONS.shoes.men || []) : (SIZE_OPTIONS.shoes.women || []);
}

Page({
  data: {
    step: 1,
    categories: [],
    catList: [],
    catTop5: [],
    catExpanded: false,
    showAddCat: false,

    clothesSizeOptions: [],
    clothesSizeTop5: [],
    clothesSizeExpanded: false,
    shoesSizeOptions: [],
    shoesSizeTop5: [],
    shoesExpanded: false,

    channelTop5: [],
    channelExpanded: false,
    channelPresets: [],

    form: {
      name: '',
      category: '',
      brandModel: '',
      clothesGender: '通用款',
      clothesSize: '',
      shoesGender: '通用款',
      shoesSizeType: '中国码',
      shoesSize: '',
      specs: { color: '', dimension: '', weight: '', material: '' },
      tags: [],
      purchaseDate: '',
      price: '',
      channel: '',
      remark: ''
    },

    inputTags: [],
    tagInput: '',
    availableTags: [],
    selectedCatIcon: '📦',
    selectedCatName: '其他',
    selectedCatColor: '#C8C4B8',
    canSave: false,

    newCatName: '',
    newCatIcon: '📦',
    newCatColor: '#4A90D9'
  },

  onLoad(options) {
    const customCats = Storage.getCategories() || [];
    const customIds = new Set(customCats.map(c => c.id));
    const builtIn = CATEGORIES.filter(c => !customIds.has(c.id));
    const allCats = customCats.length >= CATEGORIES.length ? customCats : [...builtIn, ...customCats];

    const freq = app.globalData.frequency || {};
    const availTags = getAvailableTags();

    const catTopIds = topByFreq(freq.categories || {}, 5);
    let catTop5 = catTopIds.map(id => allCats.find(c => c.id === id)).filter(Boolean);
    if (catTop5.length < 5) {
      for (const c of allCats) { if (catTop5.length >= 5) break; if (!catTop5.find(t => t.id === c.id)) catTop5.push(c); }
    }

    const channelTopIds = topByFreq(freq.channels || {}, 5);
    let channelTop5 = channelTopIds.map(id => CHANNEL_PRESETS.find(c => c === id)).filter(Boolean);
    if (channelTop5.length < 5) {
      for (const c of CHANNEL_PRESETS) { if (channelTop5.length >= 5) break; if (!channelTop5.includes(c)) channelTop5.push(c); }
    }

    const clothesOptions = getClothesOptions('通用款');
    const shoesOptions = getShoesOptions('中国码', '通用款');

    this.setData({
      categories: allCats, catList: allCats, catTop5,
      channelTop5, channelPresets: CHANNEL_PRESETS,
      availableTags: availTags,
      clothesSizeOptions: clothesOptions,
      clothesSizeTop5: clothesOptions.slice(0, 6),
      shoesSizeOptions: shoesOptions,
      shoesSizeTop5: shoesOptions.slice(0, 6),
    });

    if (options.editId) {
      const item = app.globalData.items.find(i => i.id === options.editId);
      if (item) {
        const cat = allCats.find(c => c.id === item.category) || allCats[allCats.length - 1];
        if (item.category === 'clothing') {
          const g = item.clothesGender || '通用款';
          const opts = getClothesOptions(g);
          this.setData({ clothesSizeOptions: opts, clothesSizeTop5: opts.slice(0, 5) });
        }
        if (item.category === 'shoes') {
          const t = item.shoesSizeType || '中国码';
          const opts = getShoesOptions(t);
          this.setData({ shoesSizeOptions: opts, shoesSizeTop5: opts.slice(0, 5) });
        }
        this.setData({
          isEdit: true, editId: options.editId,
          form: { ...item, specs: { ...(item.specs || {}) } },
          inputTags: item.tags || [],
          selectedCatIcon: cat.icon, selectedCatName: cat.name, selectedCatColor: cat.color
        });
      }
    }
  },

  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value });
    this.updateCanSave();
    const name = e.detail.value.trim();
    if (name.length >= 2 && !this.data.form.category) {
      const rec = recommendCategory(name);
      if (rec) {
        const cat = this.data.categories.find(c => c.id === rec);
        if (cat) {
          this.setData({
            'form.category': rec,
            selectedCatIcon: cat.icon, selectedCatName: cat.name, selectedCatColor: cat.color
          });
        }
      }
    }
  },

  updateField(e) {
    const key = e.currentTarget.dataset.key;
    const val = e.detail.value;
    const patch = { [`form.${key}`]: val };
    if (key === 'channel') patch['form.isCustomChannel'] = !CHANNEL_PRESETS.includes(val);
    this.setData(patch);
    this.updateCanSave();
  },

  updateSpec(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.specs.${key}`]: e.detail.value });
  },

  updateTagInput(e) { this.setData({ tagInput: e.detail.value }); },

  toggleCatExpand() { this.setData({ catExpanded: !this.data.catExpanded }); },

  selectCat(e) {
    const id = e.currentTarget.dataset.id;
    const cat = this.data.categories.find(c => c.id === id) || this.data.categories[this.data.categories.length - 1];
    // 切换分类时重置尺码字段，避免残留污染
    let patch = {
      'form.category': id,
      'form.clothesGender': '通用款', 'form.clothesSize': '',
      'form.shoesGender': '通用款', 'form.shoesSizeType': '中国码', 'form.shoesSize': ''
    };
    if (id === 'clothing') {
      const opts = getClothesOptions('通用款');
      patch.clothesSizeOptions = opts;
      patch.clothesSizeTop5 = opts.slice(0, 6);
    }
    if (id === 'shoes') {
      const opts = getShoesOptions('中国码', '通用款');
      patch.shoesSizeOptions = opts;
      patch.shoesSizeTop5 = opts.slice(0, 6);
    }
    this.setData(patch);
    this.setData({ selectedCatIcon: cat.icon, selectedCatName: cat.name, selectedCatColor: cat.color });
  },

  noop() {},

  onNewCatName(e) { this.setData({ newCatName: e.detail.value }); },

  showAddCatModal() { this.setData({ showAddCat: true, newCatName: '', newCatIcon: '📦', newCatColor: '#4A90D9' }); },
  hideAddCatModal() { this.setData({ showAddCat: false }); },

  setNewCatIcon(e) { this.setData({ newCatIcon: e.currentTarget.dataset.icon }); },
  setNewCatColor(e) { this.setData({ newCatColor: e.currentTarget.dataset.color }); },

  confirmAddCat() {
    const { newCatName, newCatIcon, newCatColor } = this.data;
    if (!newCatName.trim()) { wx.showToast({ title: '请输入分类名称', icon: 'none' }); return; }
    const id = 'custom_' + Date.now();
    const newCat = { id, name: newCatName.trim(), icon: newCatIcon, color: newCatColor };
    const cats = [...this.data.categories, newCat];
    Storage.setCategories(cats);
    app.globalData.categories = cats;
    this.setData({
      categories: cats, catList: cats,
      'form.category': id,
      selectedCatIcon: newCatIcon, selectedCatName: newCat.name, selectedCatColor: newCatColor,
      showAddCat: false
    });
    wx.showToast({ title: '分类已添加', icon: 'success' });
  },

  // 服装款式
  selectClothesGender(e) {
    const g = e.currentTarget.dataset.g;
    const opts = getClothesOptions(g);
    this.setData({
      'form.clothesGender': g,
      'form.clothesSize': '',
      clothesSizeOptions: opts,
      clothesSizeTop5: opts.slice(0, 5),
      clothesSizeExpanded: false
    });
  },

  // 鞋款式
  selectShoesGender(e) {
    const g = e.currentTarget.dataset.g;
    this.setData({ 'form.shoesGender': g, 'form.shoesSize': '' });
    // 中国码下切换性别，同步更新尺码列表
    if (this.data.form.shoesSizeType === '中国码') {
      const opts = getShoesOptions('中国码', g);
      this.setData({ shoesSizeOptions: opts, shoesSizeTop5: opts.slice(0, 6) });
    }
  },

  selectClothesSize(e) { this.setData({ 'form.clothesSize': e.currentTarget.dataset.size }); },
  toggleClothesExpand() { this.setData({ clothesSizeExpanded: !this.data.clothesSizeExpanded }); },

  selectShoesSizeType(e) {
    const t = e.currentTarget.dataset.t;
    const g = this.data.form.shoesGender;
    const opts = getShoesOptions(t, g);
    this.setData({
      'form.shoesSizeType': t,
      'form.shoesSize': '',
      shoesSizeOptions: opts,
      shoesSizeTop5: opts.slice(0, 6),
      shoesExpanded: false
    });
  },

  selectShoesSize(e) { this.setData({ 'form.shoesSize': e.currentTarget.dataset.size }); },
  toggleShoesExpand() { this.setData({ shoesExpanded: !this.data.shoesExpanded }); },

  selectChannel(e) { this.setData({ 'form.channel': e.currentTarget.dataset.ch, 'form.isCustomChannel': false }); },
  toggleChannelExpand() { this.setData({ channelExpanded: !this.data.channelExpanded }); },

  addTag(e) {
    const tag = (e.detail.value || this.data.tagInput).trim();
    if (!tag) return;
    const tags = this.data.inputTags;
    if (tags.includes(tag) || tags.length >= 5) return;
    this.setData({ inputTags: [...tags, tag], tagInput: '' });
  },

  pickTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const tags = [...this.data.inputTags];
    const idx = tags.indexOf(tag);
    if (idx > -1) tags.splice(idx, 1);
    else if (tags.length < 5) tags.push(tag);
    this.setData({ inputTags: tags });
  },

  removeTag(e) {
    const tags = [...this.data.inputTags];
    tags.splice(e.currentTarget.dataset.index, 1);
    this.setData({ inputTags: tags });
  },

  pickDate(e) {
    this.setData({ 'form.purchaseDate': e.detail.value });
    this.updateCanSave();
  },

  updateCanSave() {
    const f = this.data.form;
    this.setData({ canSave: !!(f.name && f.purchaseDate && f.price) });
  },

  nextStep() {
    const { step, form } = this.data;
    if (step === 1) {
      if (!form.name.trim()) { wx.showToast({ title: '请输入物品名称', icon: 'none' }); return; }
      if (!form.category) { wx.showToast({ title: '请选择分类', icon: 'none' }); return; }
      if (form.category === 'clothing' && !form.clothesGender) { wx.showToast({ title: '请选择款式', icon: 'none' }); return; }
      if (form.category === 'shoes' && !form.shoesGender) { wx.showToast({ title: '请选择款式', icon: 'none' }); return; }
      this.setData({ step: 2 });
      return;
    }
    if (step === 2) {
      if (!form.purchaseDate) { wx.showToast({ title: '请选择购买日期', icon: 'none' }); return; }
      if (!form.price) { wx.showToast({ title: '请输入购买价格', icon: 'none' }); return; }
      this.saveItem();
    }
  },

  prevStep() {
    if (this.data.step > 1) this.setData({ step: this.data.step - 1 });
  },

  saveItem() {
    const { form, inputTags, isEdit, editId } = this.data;
    if (!form.name || !form.purchaseDate || !form.price) { wx.showToast({ title: '请填写必填项', icon: 'none' }); return; }

    const item = { ...form, tags: inputTags };
    const now = Date.now();
    let items = app.globalData.items;

    if (isEdit) {
      const idx = items.findIndex(i => i.id === editId);
      if (idx !== -1) items[idx] = { ...items[idx], ...item, updatedAt: now };
    } else {
      item.id = genId();
      item.createdAt = now;
      item.updatedAt = now;
      items.unshift(item);
    }

    const freq = app.globalData.frequency || { categories: {}, sizes: {}, channels: {} };
    freq.categories = freq.categories || {};
    freq.sizes = freq.sizes || {};
    freq.channels = freq.channels || {};
    freq.categories[form.category] = (freq.categories[form.category] || 0) + 1;
    if (form.clothesSize) freq.sizes[form.clothesSize] = (freq.sizes[form.clothesSize] || 0) + 1;
    if (form.shoesSize) freq.sizes[form.shoesSize] = (freq.sizes[form.shoesSize] || 0) + 1;
    if (form.channel) freq.channels[form.channel] = (freq.channels[form.channel] || 0) + 1;

    Storage.setItems(items);
    Storage.setFrequency(freq);
    app.globalData.frequency = freq;
    app.refreshStats();

    // 后台云同步（不阻塞 UI）
    if (Cloud.isReady()) {
      const savedItem = isEdit ? items.find(i => i.id === editId) : item;
      Cloud.pushItem(savedItem).then(ok => {
        console.log('[Cloud] 物品同步:', ok ? '成功' : '失败');
      });
      Cloud.pushSettings(app.globalData.categories, freq);
    }

    wx.showToast({ title: isEdit ? '已更新' : '添加成功', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 1200);
  }
});
