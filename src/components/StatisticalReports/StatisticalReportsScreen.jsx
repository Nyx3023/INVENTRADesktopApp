import { useState, useEffect, useMemo } from 'react';
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
import {
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  ArchiveBoxXMarkIcon,
  Squares2X2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import {
  exportSalesSummaryToExcel,
  exportTopProductsToExcel,
  exportCategoryPerformanceToExcel,
  exportDeadStockToExcel,
  exportAbcAnalysisToExcel,
} from '../../utils/exportUtils';
import ModalPortal from '../common/ModalPortal';

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

const computeDeadStock = (transactions, products, daysThreshold) => {
  const lastSold = new Map();
  const totalSold = new Map();

  (transactions || []).forEach(t => {
    if (!t || !t.timestamp) return;
    const date = new Date(t.timestamp);
    (t.items || []).forEach(item => {
      const id = item.productId || item.product_id || item.name;
      const qty = Number(item.quantity) || 0;
      if (!id) return;
      if (!lastSold.has(id) || date > lastSold.get(id)) lastSold.set(id, date);
      totalSold.set(id, (totalSold.get(id) || 0) + qty);
    });
  });

  const cutoffMs = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

  return (products || [])
    .filter(p => Number(p.quantity) > 0)
    .map(p => {
      const last = lastSold.get(p.id) || lastSold.get(p.name) || null;
      const daysSinceLastSale = last ? Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const cost = Number(p.cost) || 0;
      const price = Number(p.price) || 0;
      const qty = Number(p.quantity) || 0;
      return {
        ...p,
        lastSold: last,
        daysSinceLastSale,
        totalSold: totalSold.get(p.id) || totalSold.get(p.name) || 0,
        tiedUpCost: cost * qty,
        tiedUpRetail: price * qty,
      };
    })
    .filter(p => !p.lastSold || (p.lastSold instanceof Date && p.lastSold.getTime() < cutoffMs))
    .sort((a, b) => (b.tiedUpRetail || 0) - (a.tiedUpRetail || 0));
};

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
  const [allProducts, setAllProducts] = useState([]);
  const [deadStockDays, setDeadStockDays] = useState(60);
  const [deadStock, setDeadStock] = useState([]);
  const [abcAnalysis, setAbcAnalysis] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportReportType, setExportReportType] = useState('sales_summary');
  const [exportModalDeadStockDays, setExportModalDeadStockDays] = useState(60);
  const [isExporting, setIsExporting] = useState(false);

  const DEAD_STOCK_PAGE_SIZE = 10;
  const ABC_PAGE_SIZE = 10;
  const [deadStockPage, setDeadStockPage] = useState(1);
  const [abcPage, setAbcPage] = useState(1);

  const deadStockForModalExport = useMemo(
    () => computeDeadStock(transactions, allProducts, exportModalDeadStockDays),
    [transactions, allProducts, exportModalDeadStockDays]
  );

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  useEffect(() => {
    if (allProducts.length || transactions.length) {
      setDeadStock(computeDeadStock(transactions, allProducts, deadStockDays));
    }
  }, [deadStockDays, allProducts, transactions]);

  useEffect(() => {
    setDeadStockPage(1);
  }, [deadStock, deadStockDays]);

  useEffect(() => {
    setAbcPage(1);
  }, [abcAnalysis, selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);

      // Load transactions and products
      const [transactionsData, productsData] = await Promise.all([
        transactionService.getAll(),
        productService.getAll()
      ]);

      setTransactions(transactionsData || []);
      setAllProducts(productsData || []);

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

    // Dead stock (lifetime sales — independent of selected period)
    setDeadStock(computeDeadStock(transactions, products, deadStockDays));

    // ABC analysis based on the selected period
    setAbcAnalysis(calculateAbcAnalysis(transactions, selectedPeriod, now));
  };

  const calculateAbcAnalysis = (transactions, period, now) => {
    const days = period === 'weekly' ? 7 : period === 'monthly' ? 30
      : period === 'quarterly' ? 90 : 365;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffString = cutoff.getFullYear() + '-' +
      String(cutoff.getMonth() + 1).padStart(2, '0') + '-' +
      String(cutoff.getDate()).padStart(2, '0');

    const relevant = (transactions || []).filter(t => {
      if (!t.timestamp) return false;
      const d = new Date(t.timestamp);
      const ds = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      return ds >= cutoffString;
    });

    const productAgg = {};
    relevant.forEach(t => {
      (t.items || []).forEach(item => {
        const key = item.productId || item.product_id || item.name;
        if (!key) return;
        if (!productAgg[key]) {
          productAgg[key] = { id: key, name: item.name, revenue: 0, quantity: 0 };
        }
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const subtotal = Number(item.subtotal) || price * qty;
        productAgg[key].revenue += subtotal;
        productAgg[key].quantity += qty;
      });
    });

    const sorted = Object.values(productAgg).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);

    let cumulative = 0;
    return sorted.map((p, idx) => {
      cumulative += p.revenue;
      const sharePct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
      const cumulativePct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
      let bucket = 'C';
      if (cumulativePct <= 80) bucket = 'A';
      else if (cumulativePct <= 95) bucket = 'B';
      return { ...p, rank: idx + 1, sharePct, cumulativePct, bucket };
    });
  };

  const openExportModal = () => {
    setExportReportType('sales_summary');
    setExportModalDeadStockDays(deadStockDays);
    setShowExportModal(true);
  };

  const confirmExportFromModal = () => {
    const labelFor = {
      sales_summary: 'Sales summary',
      top_products: 'Top products',
      category_performance: 'Category performance',
      dead_stock: 'Dead stock',
      abc_analysis: 'ABC analysis',
    };
    const label = labelFor[exportReportType] || 'Report';

    const canExport =
      exportReportType === 'sales_summary' ||
      (exportReportType === 'top_products' && topProducts.length > 0) ||
      (exportReportType === 'category_performance' && categoryDistribution.length > 0) ||
      (exportReportType === 'dead_stock' && deadStockForModalExport.length > 0) ||
      (exportReportType === 'abc_analysis' && abcAnalysis.length > 0);

    if (!canExport) {
      toast.error('Nothing to export for this report.');
      return;
    }

    setIsExporting(true);
    try {
      let filename;
      switch (exportReportType) {
        case 'sales_summary':
          filename = exportSalesSummaryToExcel({
            salesData,
            revenueData,
            salesGrowth,
            salesTrend,
            period: selectedPeriod,
          });
          break;
        case 'top_products':
          filename = exportTopProductsToExcel({ topProducts, period: selectedPeriod });
          break;
        case 'category_performance':
          filename = exportCategoryPerformanceToExcel({ categoryDistribution, period: selectedPeriod });
          break;
        case 'dead_stock':
          filename = exportDeadStockToExcel({
            deadStock: deadStockForModalExport,
            daysThreshold: exportModalDeadStockDays,
            period: selectedPeriod,
          });
          break;
        case 'abc_analysis':
          filename = exportAbcAnalysisToExcel({ abcAnalysis, period: selectedPeriod });
          break;
        default:
          toast.error('Unknown report type');
          setIsExporting(false);
          return;
      }
      toast.success(`Exported ${label} → ${filename}`);
      setShowExportModal(false);
    } catch (err) {
      console.error(`Failed to export ${label}:`, err);
      toast.error(`Failed to export ${label}`);
    } finally {
      setIsExporting(false);
    }
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


  const exportModalDisabled =
    (exportReportType === 'top_products' && topProducts.length === 0) ||
    (exportReportType === 'category_performance' && categoryDistribution.length === 0) ||
    (exportReportType === 'dead_stock' && deadStockForModalExport.length === 0) ||
    (exportReportType === 'abc_analysis' && abcAnalysis.length === 0);

  const periodLabels = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

  const deadStockTotalPages = Math.max(1, Math.ceil(deadStock.length / DEAD_STOCK_PAGE_SIZE));
  const deadStockCurrentPage = Math.min(deadStockPage, deadStockTotalPages);
  const deadStockStart = (deadStockCurrentPage - 1) * DEAD_STOCK_PAGE_SIZE;
  const deadStockEnd = deadStockStart + DEAD_STOCK_PAGE_SIZE;
  const paginatedDeadStock = deadStock.slice(deadStockStart, deadStockEnd);

  const abcTotalPages = Math.max(1, Math.ceil(abcAnalysis.length / ABC_PAGE_SIZE));
  const abcCurrentPage = Math.min(abcPage, abcTotalPages);
  const abcStart = (abcCurrentPage - 1) * ABC_PAGE_SIZE;
  const abcEnd = abcStart + ABC_PAGE_SIZE;
  const paginatedAbc = abcAnalysis.slice(abcStart, abcEnd);

  const renderPagination = ({ currentPage, totalPages, onChange, totalItems, startIndex, endIndex, label }) => {
    if (totalItems === 0) return null;
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    const pageNumbers = [];
    if (startPage > 1) {
      pageNumbers.push(
        <button
          key={1}
          onClick={() => onChange(1)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${colors.text.secondary} hover:${colors.bg.secondary}`}
        >
          1
        </button>
      );
      if (startPage > 2) {
        pageNumbers.push(<span key="sp-start" className={`px-2 ${colors.text.tertiary}`}>...</span>);
      }
    }
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${currentPage === i
            ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow'
            : `${colors.text.secondary} hover:${colors.bg.secondary}`
            }`}
        >
          {i}
        </button>
      );
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push(<span key="sp-end" className={`px-2 ${colors.text.tertiary}`}>...</span>);
      }
      pageNumbers.push(
        <button
          key={totalPages}
          onClick={() => onChange(totalPages)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${colors.text.secondary} hover:${colors.bg.secondary}`}
        >
          {totalPages}
        </button>
      );
    }
    return (
      <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 border-t ${colors.border.primary}`}>
        <div className={`text-xs ${colors.text.tertiary}`}>
          Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} {label}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`p-1.5 rounded-lg ${currentPage === 1
                ? `${colors.text.tertiary} cursor-not-allowed opacity-50`
                : `${colors.text.secondary} hover:${colors.bg.secondary}`
                }`}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            {pageNumbers}
            <button
              onClick={() => onChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded-lg ${currentPage === totalPages
                ? `${colors.text.tertiary} cursor-not-allowed opacity-50`
                : `${colors.text.secondary} hover:${colors.bg.secondary}`
                }`}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const exportTypeOptions = [
    {
      id: 'sales_summary',
      title: 'Sales summary',
      description: 'KPI cards, revenue / cost / profit, growth vs prior period, and daily sales trend.',
    },
    {
      id: 'top_products',
      title: 'Top products',
      description: `All ranked products (units and revenue) for the current ${periodLabels[selectedPeriod] || selectedPeriod} view.`,
    },
    {
      id: 'category_performance',
      title: 'Category performance',
      description: `Sales and share by category for the current ${periodLabels[selectedPeriod] || selectedPeriod} view.`,
    },
    {
      id: 'dead_stock',
      title: 'Dead stock',
      description: 'In-stock SKUs with no sales since the idle threshold you set below.',
    },
    {
      id: 'abc_analysis',
      title: 'ABC analysis',
      description: `Pareto classification by revenue for the current ${periodLabels[selectedPeriod] || selectedPeriod} view.`,
    },
  ];

  return (
    <>
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Reports</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={openExportModal}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            title="Choose a report type and download Excel"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export Sales Summary
          </button>
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

      {/* Dead Stock Report */}
      <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <ArchiveBoxXMarkIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Dead Stock</h2>
              <p className={`text-xs ${colors.text.tertiary}`}>
                In-stock products with no sales in the selected window.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className={`text-xs ${colors.text.secondary}`} htmlFor="dead-stock-days">Threshold</label>
            <select
              id="dead-stock-days"
              className={`border rounded-lg px-3 py-1.5 text-sm ${colors.input.primary}`}
              value={deadStockDays}
              onChange={(e) => setDeadStockDays(Number(e.target.value))}
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>365 days</option>
            </select>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className={`${colors.bg.secondary} rounded-lg p-3 border ${colors.border.primary}`}>
            <p className={`text-xs ${colors.text.tertiary}`}>Items</p>
            <p className={`text-lg font-bold ${colors.text.primary}`}>{deadStock.length}</p>
          </div>
          <div className={`${colors.bg.secondary} rounded-lg p-3 border ${colors.border.primary}`}>
            <p className={`text-xs ${colors.text.tertiary}`}>Units on hand</p>
            <p className={`text-lg font-bold ${colors.text.primary}`}>
              {deadStock.reduce((s, p) => s + (Number(p.quantity) || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className={`${colors.bg.secondary} rounded-lg p-3 border ${colors.border.primary}`}>
            <p className={`text-xs ${colors.text.tertiary}`}>Tied-up cost</p>
            <p className={`text-lg font-bold ${colors.text.primary}`}>
              {formatCurrency(deadStock.reduce((s, p) => s + (Number(p.tiedUpCost) || 0), 0))}
            </p>
          </div>
          <div className={`${colors.bg.secondary} rounded-lg p-3 border ${colors.border.primary}`}>
            <p className={`text-xs ${colors.text.tertiary}`}>Tied-up retail</p>
            <p className={`text-lg font-bold ${colors.text.primary}`}>
              {formatCurrency(deadStock.reduce((s, p) => s + (Number(p.tiedUpRetail) || 0), 0))}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Product</th>
                <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Category</th>
                <th className={`px-4 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Qty</th>
                <th className={`px-4 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Tied-up Cost</th>
                <th className={`px-4 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Tied-up Retail</th>
                <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Last Sold</th>
                <th className={`px-4 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Days Idle</th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {deadStock.length === 0 && (
                <tr>
                  <td colSpan={7} className={`px-4 py-6 text-center text-sm ${colors.text.tertiary}`}>
                    No dead stock detected for this threshold.
                  </td>
                </tr>
              )}
              {paginatedDeadStock.map((p) => (
                <tr key={p.id}>
                  <td className={`px-4 py-2 text-sm font-medium ${colors.text.primary}`}>{p.name}</td>
                  <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>{p.category_name || '—'}</td>
                  <td className={`px-4 py-2 text-sm text-right ${colors.text.secondary}`}>{p.quantity}</td>
                  <td className={`px-4 py-2 text-sm text-right ${colors.text.secondary}`}>{formatCurrency(p.tiedUpCost)}</td>
                  <td className={`px-4 py-2 text-sm text-right ${colors.text.secondary}`}>{formatCurrency(p.tiedUpRetail)}</td>
                  <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>
                    {p.lastSold ? new Date(p.lastSold).toLocaleDateString() : 'Never'}
                  </td>
                  <td className={`px-4 py-2 text-sm text-right ${colors.text.secondary}`}>
                    {p.daysSinceLastSale === null ? '—' : p.daysSinceLastSale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {renderPagination({
            currentPage: deadStockCurrentPage,
            totalPages: deadStockTotalPages,
            onChange: (page) => setDeadStockPage(Math.max(1, Math.min(page, deadStockTotalPages))),
            totalItems: deadStock.length,
            startIndex: deadStockStart,
            endIndex: deadStockEnd,
            label: 'items',
          })}
        </div>
      </div>

      {/* ABC Analysis */}
      <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Squares2X2Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${colors.text.primary}`}>ABC Analysis</h2>
              <p className={`text-xs ${colors.text.tertiary}`}>
                Pareto classification by revenue for the {selectedPeriod} period.
                A = top ~80%, B = next ~15%, C = bottom ~5%.
              </p>
            </div>
          </div>
        </div>

        {/* Class summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {['A', 'B', 'C'].map(bucket => {
            const items = abcAnalysis.filter(p => p.bucket === bucket);
            const revenue = items.reduce((s, p) => s + Number(p.revenue || 0), 0);
            const totalRevenue = abcAnalysis.reduce((s, p) => s + Number(p.revenue || 0), 0);
            const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
            const tone = bucket === 'A'
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : bucket === 'B'
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300';
            return (
              <div key={bucket} className={`${colors.bg.secondary} rounded-lg p-3 border ${colors.border.primary}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${tone}`}>Class {bucket}</span>
                  <span className={`text-xs ${colors.text.tertiary}`}>{items.length} items</span>
                </div>
                <p className={`text-base font-bold ${colors.text.primary}`}>{formatCurrency(revenue)}</p>
                <p className={`text-xs ${colors.text.tertiary}`}>{share.toFixed(1)}% of revenue</p>
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Rank</th>
                <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Product</th>
                <th className={`px-4 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Units</th>
                <th className={`px-4 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Revenue</th>
                <th className={`px-4 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Share %</th>
                <th className={`px-4 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Cumulative %</th>
                <th className={`px-4 py-2 text-center text-xs font-medium ${colors.text.secondary} uppercase`}>Class</th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {abcAnalysis.length === 0 && (
                <tr>
                  <td colSpan={7} className={`px-4 py-6 text-center text-sm ${colors.text.tertiary}`}>
                    No sales data for this period.
                  </td>
                </tr>
              )}
              {paginatedAbc.map((p) => {
                const tone = p.bucket === 'A'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : p.bucket === 'B'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
                return (
                  <tr key={p.id}>
                    <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>{p.rank}</td>
                    <td className={`px-4 py-2 text-sm font-medium ${colors.text.primary}`}>{p.name}</td>
                    <td className={`px-4 py-2 text-sm text-right ${colors.text.secondary}`}>{p.quantity}</td>
                    <td className={`px-4 py-2 text-sm text-right ${colors.text.secondary}`}>{formatCurrency(p.revenue)}</td>
                    <td className={`px-4 py-2 text-sm text-right ${colors.text.secondary}`}>{p.sharePct.toFixed(1)}%</td>
                    <td className={`px-4 py-2 text-sm text-right ${colors.text.secondary}`}>{p.cumulativePct.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-sm text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${tone}`}>{p.bucket}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {renderPagination({
            currentPage: abcCurrentPage,
            totalPages: abcTotalPages,
            onChange: (page) => setAbcPage(Math.max(1, Math.min(page, abcTotalPages))),
            totalItems: abcAnalysis.length,
            startIndex: abcStart,
            endIndex: abcEnd,
            label: 'products',
          })}
        </div>
      </div>
    </div>

    {showExportModal && (
      <ModalPortal>
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => !isExporting && setShowExportModal(false)}
        >
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${colors.border.primary} flex items-start gap-3`}>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <ArrowDownTrayIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Export to Excel</h3>
                <p className={`text-xs ${colors.text.tertiary} mt-0.5`}>
                  Pick a report. Top products, categories, and ABC use the chart period:{' '}
                  <span className="font-medium">{periodLabels[selectedPeriod] || selectedPeriod}</span>.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-3">
              {exportTypeOptions.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    exportReportType === opt.id
                      ? `border-emerald-500/60 ${colors.bg.secondary}`
                      : `${colors.border.primary} hover:bg-slate-50 dark:hover:bg-slate-800/50`
                  }`}
                >
                  <input
                    type="radio"
                    name="export-report-type"
                    className="mt-1"
                    checked={exportReportType === opt.id}
                    onChange={() => setExportReportType(opt.id)}
                  />
                  <div>
                    <p className={`text-sm font-medium ${colors.text.primary}`}>{opt.title}</p>
                    <p className={`text-xs ${colors.text.tertiary} mt-0.5`}>{opt.description}</p>
                  </div>
                </label>
              ))}

              {exportReportType === 'dead_stock' && (
                <div className={`pt-2 border-t ${colors.border.primary}`}>
                  <label className={`text-xs font-medium ${colors.text.secondary}`} htmlFor="export-modal-dead-days">
                    Idle threshold (no sales in this window)
                  </label>
                  <select
                    id="export-modal-dead-days"
                    className={`mt-1.5 border rounded-lg px-3 py-2 text-sm w-full ${colors.input.primary}`}
                    value={exportModalDeadStockDays}
                    onChange={(e) => setExportModalDeadStockDays(Number(e.target.value))}
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>180 days</option>
                    <option value={365}>365 days</option>
                  </select>
                  <p className={`text-xs ${colors.text.tertiary} mt-1.5`}>
                    {deadStockForModalExport.length} item(s) match this threshold for export.
                  </p>
                </div>
              )}
            </div>

            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
                className={`px-4 py-2 rounded-lg border ${colors.border.primary} ${colors.text.secondary} disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmExportFromModal}
                disabled={isExporting || exportModalDisabled}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium inline-flex items-center gap-2 disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {isExporting ? 'Exporting…' : 'Download .xlsx'}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    )}
    </>
  );
};

export default StatisticalReportsScreen;

