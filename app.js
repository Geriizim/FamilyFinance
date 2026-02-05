const state = {
  transactions: [],
  selectedMonth: null,
  categoryFilter: 'all',
  budgets: {},
  categories: [
    'Boende',
    'Mat & dagligvaror',
    'Transport',
    'Nöje',
    'Resor',
    'Barn',
    'Hälsa',
    'Sparande',
    'Inkomst',
    'Övrigt'
  ],
  rules: [
    { keyword: 'lön', category: 'Inkomst' },
    { keyword: 'salary', category: 'Inkomst' },
    { keyword: 'hyra', category: 'Boende' },
    { keyword: 'rent', category: 'Boende' },
    { keyword: 'ica', category: 'Mat & dagligvaror' },
    { keyword: 'coop', category: 'Mat & dagligvaror' },
    { keyword: 'hemköp', category: 'Mat & dagligvaror' },
    { keyword: 'spotify', category: 'Nöje' },
    { keyword: 'netflix', category: 'Nöje' },
    { keyword: 'sl', category: 'Transport' },
    { keyword: 'sas', category: 'Resor' },
    { keyword: 'apotek', category: 'Hälsa' },
    { keyword: 'försäkring', category: 'Hälsa' }
  ]
};

const fileInput = document.getElementById('file-input');
const demoButton = document.getElementById('demo-button');
const monthSelect = document.getElementById('month-select');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const transactionBody = document.getElementById('transaction-body');
const statsGrid = document.getElementById('stats-grid');
const comparisonGrid = document.getElementById('comparison-grid');
const insightsGrid = document.getElementById('insights-grid');
const budgetGrid = document.getElementById('budget-grid');
const applySimilarToggle = document.getElementById('apply-similar');
const syncStatus = document.getElementById('sync-status');
const syncLabel = document.getElementById('sync-label');
const syncMeta = document.getElementById('sync-meta');
const syncButton = document.getElementById('sync-button');
const statusDot = syncStatus.querySelector('.status-dot');

const currencyFormatter = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK'
});

const monthFormatter = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: 'long'
});

const dateFormatter = new Intl.DateTimeFormat('sv-SE');

const normalizeText = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .replace(/[0-9]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value;
  }
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '-');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return null;
};

const setSyncStatus = (stateLabel, detail, tone) => {
  syncLabel.textContent = stateLabel;
  syncMeta.textContent = detail;
  statusDot.classList.remove('synced', 'error');
  if (tone === 'success') {
    statusDot.classList.add('synced');
  } else if (tone === 'error') {
    statusDot.classList.add('error');
  }
};

const serializeTransaction = (transaction) => ({
  date: transaction.date.toISOString().slice(0, 10),
  description: transaction.description,
  amount: transaction.amount,
  balance: transaction.balance,
  category: transaction.category,
  currency: transaction.currency,
  cardHolder: transaction.cardHolder
});

const syncTransactions = async () => {
  if (!state.transactions.length) {
    setSyncStatus('Ej synkad', 'Ingen data att spara', 'error');
    return;
  }
  setSyncStatus('Synkar...', 'Skickar data till PostgreSQL', null);
  try {
    const response = await fetch('/api/transactions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.transactions.map(serializeTransaction))
    });
    if (!response.ok) {
      throw new Error('Sync failed');
    }
    const now = new Date();
    setSyncStatus('Synkad', `Senast ${dateFormatter.format(now)} ${now.toLocaleTimeString('sv-SE')}`, 'success');
  } catch (error) {
    setSyncStatus('Fel vid synk', 'Kontrollera att servern är igång', 'error');
  }
};

const classifyTransaction = (transaction) => {
  const text = normalizeText(transaction.description);
  const rule = state.rules.find((item) => text.includes(item.keyword));
  if (rule) {
    return rule.category;
  }
  if (transaction.amount > 0) {
    return 'Inkomst';
  }
  return 'Övrigt';
};

const inferSimilarGroup = (transaction) => normalizeText(transaction.description);

const applyCategoryToSimilar = (source, category) => {
  const groupKey = inferSimilarGroup(source);
  state.transactions.forEach((item) => {
    if (inferSimilarGroup(item) === groupKey) {
      item.category = category;
    }
  });
};

const createOption = (value, label) => {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
};

const formatAmountClass = (value) => (value >= 0 ? 'stat-positive' : 'stat-negative');

const computeMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthRange = (transactions) => {
  const months = Array.from(
    new Set(transactions.map((item) => computeMonthKey(item.date)))
  ).sort();
  return months;
};

const updateFilters = () => {
  const months = getMonthRange(state.transactions);
  monthSelect.innerHTML = '';
  months.forEach((month) => {
    const [year, monthIndex] = month.split('-').map(Number);
    const date = new Date(year, monthIndex - 1, 1);
    monthSelect.append(createOption(month, monthFormatter.format(date)));
  });
  if (!state.selectedMonth && months.length) {
    state.selectedMonth = months[months.length - 1];
  }
  monthSelect.value = state.selectedMonth || '';

  categoryFilter.innerHTML = '';
  categoryFilter.append(createOption('all', 'Alla'));
  state.categories.forEach((category) => {
    categoryFilter.append(createOption(category, category));
  });
};

const getFilteredTransactions = () => {
  const searchValue = normalizeText(searchInput.value);
  return state.transactions.filter((item) => {
    const matchesMonth = state.selectedMonth
      ? computeMonthKey(item.date) === state.selectedMonth
      : true;
    const matchesCategory = state.categoryFilter === 'all' || item.category === state.categoryFilter;
    const matchesSearch = !searchValue || normalizeText(item.description).includes(searchValue);
    return matchesMonth && matchesCategory && matchesSearch;
  });
};

const computeTotals = (items) => {
  const income = items.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const expenses = items.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0);
  const net = income + expenses;
  return { income, expenses, net };
};

const computeCategoryTotals = (items) => {
  return items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});
};

const renderStats = () => {
  const filtered = getFilteredTransactions();
  const totals = computeTotals(filtered);
  const items = [
    { label: 'Inkomster', value: totals.income },
    { label: 'Utgifter', value: totals.expenses },
    { label: 'Netto', value: totals.net }
  ];
  statsGrid.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <p>${item.label}</p>
      <div class="stat-value ${formatAmountClass(item.value)}">${currencyFormatter.format(item.value)}</div>
    `;
    statsGrid.append(card);
  });
};

const getMonthTransactions = (monthKey) =>
  state.transactions.filter((item) => computeMonthKey(item.date) === monthKey);

const renderComparisons = () => {
  if (!state.selectedMonth) {
    comparisonGrid.innerHTML = '';
    return;
  }
  const [year, month] = state.selectedMonth.split('-').map(Number);
  const currentItems = getMonthTransactions(state.selectedMonth);
  const previousMonthDate = new Date(year, month - 2, 1);
  const previousMonthKey = computeMonthKey(previousMonthDate);
  const previousYearKey = `${year - 1}-${String(month).padStart(2, '0')}`;

  const currentTotals = computeTotals(currentItems);
  const prevMonthTotals = computeTotals(getMonthTransactions(previousMonthKey));
  const prevYearTotals = computeTotals(getMonthTransactions(previousYearKey));

  const cards = [
    {
      title: 'Månad / Månad',
      value: currentTotals.expenses - prevMonthTotals.expenses,
      description: `Jämfört med ${monthFormatter.format(previousMonthDate)}`
    },
    {
      title: 'År / År',
      value: currentTotals.expenses - prevYearTotals.expenses,
      description: `Jämfört med ${monthFormatter.format(new Date(year - 1, month - 1, 1))}`
    },
    {
      title: 'Netto-utveckling',
      value: currentTotals.net - prevMonthTotals.net,
      description: 'Skillnad mot föregående månad'
    }
  ];

  comparisonGrid.innerHTML = '';
  cards.forEach((card) => {
    const element = document.createElement('div');
    element.className = 'comparison-card';
    element.innerHTML = `
      <h3>${card.title}</h3>
      <p>${card.description}</p>
      <div class="stat-value ${formatAmountClass(card.value)}">${currencyFormatter.format(card.value)}</div>
    `;
    comparisonGrid.append(element);
  });
};

const buildInsights = (items) => {
  if (!items.length) {
    return [];
  }
  const expenses = items.filter((item) => item.amount < 0);
  const income = items.filter((item) => item.amount > 0);
  const categoryTotals = computeCategoryTotals(expenses);
  const topCategory = Object.entries(categoryTotals).sort((a, b) => a[1] - b[1])[0];
  const largestExpense = expenses.sort((a, b) => a.amount - b.amount)[0];
  const largestIncome = income.sort((a, b) => b.amount - a.amount)[0];
  const avgDailySpend = Math.abs(expenses.reduce((sum, item) => sum + item.amount, 0)) / 30;

  return [
    {
      title: 'Största utgiften',
      value: largestExpense
        ? `${currencyFormatter.format(largestExpense.amount)}`
        : 'Ingen utgift',
      description: largestExpense ? largestExpense.description : 'Inga utgifter ännu',
      meta: 'Kontrollera denna',
      tone: 'warning',
      numericValue: largestExpense ? largestExpense.amount : 0
    },
    {
      title: 'Högsta inkomst',
      value: largestIncome ? currencyFormatter.format(largestIncome.amount) : 'Ingen inkomst',
      description: largestIncome ? largestIncome.description : 'Inga inkomster ännu',
      meta: 'Bra inflöde',
      tone: 'success',
      numericValue: largestIncome ? largestIncome.amount : 0
    },
    {
      title: 'Största kategori',
      value: topCategory ? currencyFormatter.format(topCategory[1]) : 'Ingen data',
      description: topCategory ? topCategory[0] : 'Inga utgifter ännu',
      meta: 'Prioritera',
      tone: 'warning',
      numericValue: topCategory ? topCategory[1] : 0
    },
    {
      title: 'Snitt per dag',
      value: currencyFormatter.format(-avgDailySpend || 0),
      description: 'Baserat på senaste månaden',
      meta: 'Jämför över tid',
      tone: 'neutral',
      numericValue: -avgDailySpend || 0
    }
  ];
};

const renderInsights = () => {
  const filtered = getFilteredTransactions();
  const cards = buildInsights(filtered);
  insightsGrid.innerHTML = '';
  cards.forEach((card) => {
    const element = document.createElement('div');
    element.className = 'insight-card';
    const metaClass = card.tone && card.tone !== 'neutral' ? `insight-meta ${card.tone}` : 'insight-meta';
    element.innerHTML = `
      <h3>${card.title}</h3>
      <div class="stat-value ${formatAmountClass(card.numericValue)}">${card.value}</div>
      <p>${card.description}</p>
      <span class="${metaClass}">${card.meta}</span>
    `;
    insightsGrid.append(element);
  });
};

const renderBudgets = () => {
  const filtered = getFilteredTransactions();
  const totals = computeCategoryTotals(filtered);
  budgetGrid.innerHTML = '';

  state.categories.forEach((category) => {
    const value = totals[category] || 0;
    const budget = state.budgets[category] || 0;
    const percent = budget ? Math.min(Math.abs(value / budget) * 100, 100) : 0;

    const card = document.createElement('div');
    card.className = 'budget-card';
    card.innerHTML = `
      <h3>${category}</h3>
      <p>${currencyFormatter.format(value)} / ${budget ? currencyFormatter.format(budget) : 'Ingen budget'}</p>
      <label>
        Budget
        <input type="number" min="0" value="${budget || ''}" data-category="${category}" placeholder="t.ex. 5000" />
      </label>
      <div class="progress"><span style="width: ${percent}%;"></span></div>
    `;
    budgetGrid.append(card);
  });

  budgetGrid.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const { category } = event.target.dataset;
      state.budgets[category] = Number(event.target.value);
      renderBudgets();
    });
  });
};

const renderTransactions = () => {
  const filtered = getFilteredTransactions();
  transactionBody.innerHTML = '';

  filtered.forEach((item) => {
    const row = document.createElement('tr');

    const categorySelect = document.createElement('select');
    state.categories.forEach((category) => {
      const option = createOption(category, category);
      if (category === item.category) {
        option.selected = true;
      }
      categorySelect.append(option);
    });

    categorySelect.addEventListener('change', (event) => {
      const newCategory = event.target.value;
      if (applySimilarToggle.checked) {
        applyCategoryToSimilar(item, newCategory);
      } else {
        item.category = newCategory;
      }
      renderAll();
      syncTransactions();
    });

    row.innerHTML = `
      <td>${dateFormatter.format(item.date)}</td>
      <td>${item.description}</td>
      <td class="${formatAmountClass(item.amount)}">${currencyFormatter.format(item.amount)}</td>
      <td></td>
      <td>${item.balance ? currencyFormatter.format(item.balance) : '-'}</td>
    `;

    row.children[3].append(categorySelect);
    transactionBody.append(row);
  });
};

const renderAll = () => {
  updateFilters();
  renderStats();
  renderComparisons();
  renderInsights();
  renderBudgets();
  renderTransactions();
};

const parseRows = (rows) => {
  const headers = rows[0];
  const mapped = rows.slice(1).filter((row) => row.some((cell) => cell !== undefined && cell !== ''));

  const headerMap = headers.reduce((acc, header, index) => {
    if (!header) return acc;
    acc[header.toString().trim()] = index;
    return acc;
  }, {});

  return mapped.map((row) => {
    const get = (name) => row[headerMap[name]];
    const dateRaw = get('Transaktionsdatum') || get('Reskontradatum');
    const description = get('Text') || get('Inköpsställe') || 'Okänd';
    const amount = Number(get('Belopp') || 0);
    const balance = Number(get('Saldo') || 0);
    const transaction = {
      date: parseDate(dateRaw) || new Date(),
      description,
      amount,
      balance,
      currency: get('Valuta') || 'SEK',
      cardHolder: get('Kortinnehavare') || ''
    };
    transaction.category = classifyTransaction(transaction);
    return transaction;
  });
};

const loadWorkbook = (data) => {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  state.transactions = parseRows(rows);
  state.selectedMonth = null;
  renderAll();
  syncTransactions();
};

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const data = await file.arrayBuffer();
  loadWorkbook(data);
});

monthSelect.addEventListener('change', (event) => {
  state.selectedMonth = event.target.value;
  renderAll();
});

searchInput.addEventListener('input', () => {
  renderAll();
});

categoryFilter.addEventListener('change', (event) => {
  state.categoryFilter = event.target.value;
  renderAll();
});

demoButton.addEventListener('click', () => {
  state.transactions = buildDemoData();
  state.selectedMonth = null;
  renderAll();
  syncTransactions();
});

syncButton.addEventListener('click', () => {
  syncTransactions();
});

const buildDemoData = () => {
  const now = new Date();
  const demo = [
    { date: new Date(now.getFullYear(), now.getMonth(), 1), description: 'Lön AB', amount: 35000 },
    { date: new Date(now.getFullYear(), now.getMonth(), 2), description: 'Hyra', amount: -12500 },
    { date: new Date(now.getFullYear(), now.getMonth(), 3), description: 'ICA Kvantum', amount: -1850 },
    { date: new Date(now.getFullYear(), now.getMonth(), 5), description: 'SL biljett', amount: -980 },
    { date: new Date(now.getFullYear(), now.getMonth(), 7), description: 'Netflix', amount: -179 },
    { date: new Date(now.getFullYear(), now.getMonth() - 1, 2), description: 'Hyra', amount: -12500 },
    { date: new Date(now.getFullYear(), now.getMonth() - 1, 3), description: 'ICA Kvantum', amount: -2100 },
    { date: new Date(now.getFullYear() - 1, now.getMonth(), 1), description: 'Lön AB', amount: 32000 },
    { date: new Date(now.getFullYear() - 1, now.getMonth(), 4), description: 'ICA Kvantum', amount: -1500 }
  ];
  return demo.map((item, index) => {
    const transaction = {
      ...item,
      balance: 50000 - index * 1000,
      currency: 'SEK',
      cardHolder: 'Demo'
    };
    transaction.category = classifyTransaction(transaction);
    return transaction;
  });
};

state.transactions = buildDemoData();
renderAll();
