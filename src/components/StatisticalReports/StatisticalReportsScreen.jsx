import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { transactionService, productService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { formatCurrency } from '../../utils/formatters';
import { CalendarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ShoppingBagIcon, CurrencyDollarIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const StatisticalReportsScreen = () => {
  const { colors } = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [salesData, setSalesData] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0,
    quarterly: 0,
    yearly: 0,
  });
  const [revenueData, setRevenueData] = useState({
    revenue: 0,
    cost: 0,
    profit: 0,
    margin: 0,
    itemsSold: 0,
  });
  const [topProducts, setTopProducts] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [categoryDistribution, setCategoryDistribution] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [salesGrowth, setSalesGrowth] = useState({
    weekly: 0,
    monthly: 0,
    quarterly: 0,
    yearly: 0
  });
  const [hasPreviousData, setHasPreviousData] = useState({
    weekly: false,
    monthly: false,
    quarterly: false,
    yearly: false
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);

      // Load transactions and products
      const [transactionsData, productsData] = await Promise.all([
        transactionService.getAll(),
        productService.getAll()
      ]);

      setTransactions(transactionsData || []);

      // Process analytics data
      processAnalyticsData(transactionsData || [], productsData || []);

    } catch (error) {
      console.error('Error loading statistical reports data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processAnalyticsData = (transactions, products) => {
    const now = new Date();

    // Calculate sales data for different periods
    const periodSales = calculatePeriodSales(transactions, now);
    setSalesData(periodSales);

    // Calculate revenue/cost/profit metrics
    const revenueMetrics = calculateRevenueMetrics(transactions, selectedPeriod, now);
    setRevenueData(revenueMetrics);

    // Calculate sales trend based on selected period
    const trendData = calculateSalesTrend(transactions, selectedPeriod, now);
    setSalesTrend(trendData);

    // Calculate top products
    const topProductsData = calculateTopProducts(transactions, selectedPeriod, now);
    setTopProducts(topProductsData);

    // Calculate category distribution
    const categoryData = calculateCategoryDistribution(transactions, selectedPeriod, now);
    setCategoryDistribution(categoryData);

    // Calculate sales growth
    const growthData = calculateSalesGrowth(transactions, now);
    setSalesGrowth(growthData);
  };

  const calculateRevenueMetrics = (transactions, period, now) => {
    const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 :
      period === 'quarterly' ? 90 : 365;

    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateString = cutoffDate.getFullYear() + '-' +
      String(cutoffDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(cutoffDate.getDate()).padStart(2, '0');

    const relevantTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.timestamp);
      const transactionDateString = transactionDate.getFullYear() + '-' +
        String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(transactionDate.getDate()).padStart(2, '0');
      return transactionDateString >= cutoffDateString;
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalItemsSold = 0;

    relevantTransactions.forEach(transaction => {
      transaction.items?.forEach(item => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const cost = Number(item.cost) || 0;
        totalRevenue += price * qty;
        totalCost += cost * qty;
        totalItemsSold += qty;
      });
    });

    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit,
      margin,
      itemsSold: totalItemsSold,
    };
  };

  const calculatePeriodSales = (transactions, now) => {
    // Get today's date in local timezone
    const today = new Date();
    const todayDateString = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);
    const monthStart = new Date(today);
    monthStart.setDate(today.getDate() - 30);
    const quarterStart = new Date(today);
    quarterStart.setDate(today.getDate() - 90);
    const yearStart = new Date(today);
    yearStart.setDate(today.getDate() - 365);

    return {
      daily: transactions
        .filter(t => {
          const transactionDate = new Date(t.timestamp);
          const transactionDateString = transactionDate.getFullYear() + '-' +
            String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(transactionDate.getDate()).padStart(2, '0');
          return transactionDateString === todayDateString;
        })
        .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0),
      weekly: transactions
        .filter(t => new Date(t.timestamp) >= weekStart)
        .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0),
      monthly: transactions
        .filter(t => new Date(t.timestamp) >= monthStart)
        .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0),
      quarterly: transactions
        .filter(t => new Date(t.timestamp) >= quarterStart)
        .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0),
      yearly: transactions
        .filter(t => new Date(t.timestamp) >= yearStart)
        .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0)
    };
  };

  const calculateSalesTrend = (transactions, period, now) => {
    const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 :
      period === 'quarterly' ? 90 : 365;

    const trendData = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Use local timezone date comparison instead of ISO string
      const targetDateString = date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');

      const dayTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.timestamp);
        const transactionDateString = transactionDate.getFullYear() + '-' +
          String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(transactionDate.getDate()).padStart(2, '0');
        return transactionDateString === targetDateString;
      });

      const dayTotal = dayTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

      trendData.push({
        date: period === 'yearly' ?
          date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) :
          date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: dayTotal
      });
    }

    console.log('Sales trend data:', { period, days, trendDataLength: trendData.length, sampleData: trendData.slice(0, 3) });
    return trendData;
  };

  const calculateTopProducts = (transactions, period, now) => {
    const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 :
      period === 'quarterly' ? 90 : 365;

    // Use local timezone date comparison
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateString = cutoffDate.getFullYear() + '-' +
      String(cutoffDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(cutoffDate.getDate()).padStart(2, '0');

    const relevantTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.timestamp);
      const transactionDateString = transactionDate.getFullYear() + '-' +
        String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(transactionDate.getDate()).padStart(2, '0');
      return transactionDateString >= cutoffDateString;
    });

    const productSales = {};

    relevantTransactions.forEach(transaction => {
      transaction.items?.forEach(item => {
        if (!productSales[item.productId || item.name]) {
          productSales[item.productId || item.name] = {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[item.productId || item.name].quantity += item.quantity;
        productSales[item.productId || item.name].revenue += (parseFloat(item.subtotal) || 0);
      });
    });

    const result = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    console.log('Top products calculation:', { period, relevantTransactions: relevantTransactions.length, topProducts: result.length });
    return result;
  };

  const calculateCategoryDistribution = (transactions, period, now) => {
    const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 :
      period === 'quarterly' ? 90 : 365;

    // Use local timezone date comparison
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateString = cutoffDate.getFullYear() + '-' +
      String(cutoffDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(cutoffDate.getDate()).padStart(2, '0');

    const relevantTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.timestamp);
      const transactionDateString = transactionDate.getFullYear() + '-' +
        String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(transactionDate.getDate()).padStart(2, '0');
      return transactionDateString >= cutoffDateString;
    });

    const categorySales = {};

    relevantTransactions.forEach(transaction => {
      transaction.items?.forEach(item => {
        // Handle missing category data - get category from transaction item or default
        let category = item.category;

        // If no category in item, try to get it from the product name pattern or default
        if (!category || category.trim() === '') {
          category = 'Uncategorized';
        }

        if (!categorySales[category]) {
          categorySales[category] = 0;
        }
        categorySales[category] += (parseFloat(item.subtotal) || parseFloat(item.price) * item.quantity || 0);
      });
    });

    const result = Object.entries(categorySales)
      .map(([category, sales]) => ({ category, sales }))
      .sort((a, b) => b.sales - a.sales);

    console.log('Category distribution calculation:', {
      period,
      relevantTransactions: relevantTransactions.length,
      categories: result.length,
      categorySales,
      result: result.slice(0, 3)
    });

    return result;
  };

  const calculateSalesGrowth = (transactions, now) => {
    const periods = [
      { key: 'weekly', days: 7 },
      { key: 'monthly', days: 30 },
      { key: 'quarterly', days: 90 },
      { key: 'yearly', days: 365 }
    ];

    const growth = {};
    const previousDataFlags = {};

    periods.forEach(({ key, days }) => {
      // Use date string comparison for consistency with calculatePeriodSales
      const today = new Date(now);
      today.setHours(0, 0, 0, 0); // Reset to start of day

      // Current period: from (today - days) to today (inclusive)
      const currentPeriodStart = new Date(today);
      currentPeriodStart.setDate(currentPeriodStart.getDate() - days);
      const currentPeriodStartString = currentPeriodStart.getFullYear() + '-' +
        String(currentPeriodStart.getMonth() + 1).padStart(2, '0') + '-' +
        String(currentPeriodStart.getDate()).padStart(2, '0');

      // Previous period: from (today - 2*days) to (today - days) (exclusive of current period start)
      const previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
      const previousPeriodStartString = previousPeriodStart.getFullYear() + '-' +
        String(previousPeriodStart.getMonth() + 1).padStart(2, '0') + '-' +
        String(previousPeriodStart.getDate()).padStart(2, '0');

      const todayString = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

      // Calculate current period sales (from currentPeriodStart to today, inclusive)
      const currentSales = transactions
        .filter(t => {
          if (!t.timestamp) return false;
          const transactionDate = new Date(t.timestamp);
          const transactionDateString = transactionDate.getFullYear() + '-' +
            String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(transactionDate.getDate()).padStart(2, '0');
          return transactionDateString >= currentPeriodStartString &&
            transactionDateString <= todayString;
        })
        .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

      // Calculate previous period sales (from previousPeriodStart to currentPeriodStart, exclusive)
      const previousSales = transactions
        .filter(t => {
          if (!t.timestamp) return false;
          const transactionDate = new Date(t.timestamp);
          const transactionDateString = transactionDate.getFullYear() + '-' +
            String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(transactionDate.getDate()).padStart(2, '0');
          return transactionDateString >= previousPeriodStartString &&
            transactionDateString < currentPeriodStartString;
        })
        .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

      // Calculate growth percentage
      if (previousSales > 0) {
        growth[key] = ((currentSales - previousSales) / previousSales) * 100;
        previousDataFlags[key] = true;
      } else {
        // If no previous sales data, set growth to null to indicate N/A
        growth[key] = null;
        previousDataFlags[key] = false;
      }

      // Debug logging
      console.log(`Growth calculation for ${key}:`, {
        currentPeriodStart: currentPeriodStartString,
        today: todayString,
        previousPeriodStart: previousPeriodStartString,
        currentSales,
        previousSales,
        growth: growth[key],
        hasPreviousData: previousDataFlags[key]
      });
    });

    setHasPreviousData(previousDataFlags);
    return growth;
  };

  const salesTrendData = {
    labels: salesTrend.map(item => item.date),
    datasets: [
      {
        label: `Sales Trend (₱) - ${selectedPeriod}`,
        data: salesTrend.map(item => item.amount),
        fill: true,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderColor: 'rgba(99, 102, 241, 1)',
        tension: 0.4,
      },
    ],
  };

  const categoryData = {
    labels: categoryDistribution.map(item => item.category),
    datasets: [
      {
        data: categoryDistribution.map(item => item.sales),
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const topProductsData = {
    labels: topProducts.map(item => item.name),
    datasets: [
      {
        label: 'Units Sold',
        data: topProducts.map(item => item.quantity),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  const getGrowthIcon = (growth) => {
    if (growth === null || growth === undefined) return null;
    if (growth > 0) return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />;
    if (growth < 0) return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4" />;
  };

  const getGrowthColor = (growth) => {
    if (growth === null || growth === undefined) return 'text-gray-500';
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatGrowth = (growth) => {
    if (growth === null || growth === undefined) return 'N/A';
    return `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className={`${colors.text.secondary}`}>Loading statistical reports...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Reports</h1>
        <div className="flex items-center gap-4">
          <select
            className={`border rounded-lg px-3 py-2 ${colors.input.primary}`}
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="weekly">Weekly View</option>
            <option value="monthly">Monthly View</option>
            <option value="quarterly">Quarterly View</option>
            <option value="yearly">Yearly View</option>
          </select>
          <div className={`flex items-center text-sm ${colors.text.secondary}`}>
            <CalendarIcon className="h-4 w-4 mr-1" />
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`${colors.text.secondary} text-sm`}>Daily Sales</h3>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(salesData.daily || 0)}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <CurrencyDollarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex items-center mt-2">
            {getGrowthIcon(salesGrowth.weekly)}
            <span className={`text-sm ml-1 ${getGrowthColor(salesGrowth.weekly)}`}>
              {formatGrowth(salesGrowth.weekly)} vs last week
            </span>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`${colors.text.secondary} text-sm`}>Weekly Sales</h3>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(salesData.weekly || 0)}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <ArrowTrendingUpIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="flex items-center mt-2">
            {getGrowthIcon(salesGrowth.weekly)}
            <span className={`text-sm ml-1 ${getGrowthColor(salesGrowth.weekly)}`}>
              {formatGrowth(salesGrowth.weekly)} vs last week
            </span>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`${colors.text.secondary} text-sm`}>Monthly Sales</h3>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(salesData.monthly || 0)}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
              <ShoppingBagIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="flex items-center mt-2">
            {getGrowthIcon(salesGrowth.monthly)}
            <span className={`text-sm ml-1 ${getGrowthColor(salesGrowth.monthly)}`}>
              {formatGrowth(salesGrowth.monthly)} vs last month
            </span>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`${colors.text.secondary} text-sm`}>Yearly Sales</h3>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(salesData.yearly || 0)}</p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
              <CalendarIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <div className="flex items-center mt-2">
            {getGrowthIcon(salesGrowth.yearly)}
            <span className={`text-sm ml-1 ${getGrowthColor(salesGrowth.yearly)}`}>
              {formatGrowth(salesGrowth.yearly)} vs last year
            </span>
          </div>
        </div>
      </div>

      {/* Revenue & Profit Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={`${colors.card.primary} p-5 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center gap-2 mb-2">
            <ChartBarIcon className="h-4 w-4 text-blue-500" />
            <h3 className={`${colors.text.secondary} text-xs uppercase tracking-wider font-medium`}>Revenue</h3>
          </div>
          <p className={`text-xl font-bold ${colors.text.primary}`}>{formatCurrency(revenueData.revenue)}</p>
        </div>
        <div className={`${colors.card.primary} p-5 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
            <h3 className={`${colors.text.secondary} text-xs uppercase tracking-wider font-medium`}>Cost</h3>
          </div>
          <p className={`text-xl font-bold text-red-600 dark:text-red-400`}>{formatCurrency(revenueData.cost)}</p>
        </div>
        <div className={`${colors.card.primary} p-5 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-500" />
            <h3 className={`${colors.text.secondary} text-xs uppercase tracking-wider font-medium`}>Gross Profit</h3>
          </div>
          <p className={`text-xl font-bold ${revenueData.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(revenueData.profit)}
          </p>
        </div>
        <div className={`${colors.card.primary} p-5 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center gap-2 mb-2">
            <CurrencyDollarIcon className="h-4 w-4 text-purple-500" />
            <h3 className={`${colors.text.secondary} text-xs uppercase tracking-wider font-medium`}>Profit Margin</h3>
          </div>
          <p className={`text-xl font-bold ${revenueData.margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {revenueData.margin.toFixed(1)}%
          </p>
        </div>
        <div className={`${colors.card.primary} p-5 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBagIcon className="h-4 w-4 text-amber-500" />
            <h3 className={`${colors.text.secondary} text-xs uppercase tracking-wider font-medium`}>Items Sold</h3>
          </div>
          <p className={`text-xl font-bold ${colors.text.primary}`}>{revenueData.itemsSold.toLocaleString()}</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>
            Sales Trend ({selectedPeriod})
          </h2>
          <div className="h-64">
            <Line data={salesTrendData} options={chartOptions} />
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>
            Sales by Category ({selectedPeriod})
          </h2>
          <div className="h-64">
            <Doughnut data={categoryData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="mt-6">
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>
            Top Products ({selectedPeriod})
          </h2>
          <div className="h-64">
            <Bar data={topProductsData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>Top Products Details</h2>
          <div className="overflow-x-auto">
            <table className={`min-w-full divide-y ${colors.border.primary}`}>
              <thead className={`${colors.bg.secondary}`}>
                <tr>
                  <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Product</th>
                  <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Units Sold</th>
                  <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Revenue</th>
                </tr>
              </thead>
              <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
                {topProducts.slice(0, 5).map((product, index) => (
                  <tr key={index}>
                    <td className={`px-4 py-2 text-sm font-medium ${colors.text.primary}`}>{product.name}</td>
                    <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>{product.quantity}</td>
                    <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>{formatCurrency(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>Category Performance</h2>
          <div className="overflow-x-auto">
            <table className={`min-w-full divide-y ${colors.border.primary}`}>
              <thead className={`${colors.bg.secondary}`}>
                <tr>
                  <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Category</th>
                  <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Sales</th>
                  <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Share</th>
                </tr>
              </thead>
              <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
                {categoryDistribution.slice(0, 5).map((category, index) => {
                  const totalSales = categoryDistribution.reduce((sum, cat) => sum + cat.sales, 0);
                  const share = totalSales > 0 ? (category.sales / totalSales) * 100 : 0;
                  return (
                    <tr key={index}>
                      <td className={`px-4 py-2 text-sm font-medium ${colors.text.primary}`}>{category.category}</td>
                      <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>{formatCurrency(category.sales)}</td>
                      <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>{share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticalReportsScreen;

