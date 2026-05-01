import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  CubeIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ShoppingBagIcon,
  EyeIcon,
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MinusIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { analyticsService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/formatters';
import LazyPageLoader from '../common/LazyPageLoader';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DashboardScreen = () => {
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();
  const { settings } = useSettings();

  const [summary, setSummary] = useState({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    totalStock: 0
  });

  const [salesMetrics, setSalesMetrics] = useState({
    totalSales: 0,
    dailySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    weeklyGrowth: 0,
    monthlyGrowth: 0,
    averageOrderValue: 0,
    totalTransactions: 0
  });

  const [recentTransactions, setRecentTransactions] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [salesTrendData, setSalesTrendData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('weekly'); // for Sales Overview chart ONLY
  const [selectedRange, setSelectedRange] = useState('weekly'); // for stat cards + top sellers

  useEffect(() => {
    loadDashboardData();
  }, [selectedRange, selectedPeriod, settings.lowStockThreshold]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const data = await analyticsService.getDashboardSummary({
        period: selectedRange,
        trendPeriod: selectedPeriod, // separate param for Sales Overview chart
        lowStockThreshold: settings.lowStockThreshold ?? 10,
      });

      setSummary(data.summary || {
        totalProducts: 0,
        lowStock: 0,
        outOfStock: 0,
        totalStock: 0,
      });
      setSalesMetrics(data.salesMetrics || {
        totalSales: 0,
        dailySales: 0,
        weeklySales: 0,
        monthlySales: 0,
        weeklyGrowth: 0,
        monthlyGrowth: 0,
        averageOrderValue: 0,
        totalTransactions: 0,
      });
      setRecentTransactions(data.recentTransactions || []);
      setTopProducts(data.topProducts || []);
      setSalesTrendData(data.salesTrend || []);

      // Alerts based on server summary
      const outOfStock = Number(data?.summary?.outOfStock || 0);
      const lowStock = Number(data?.summary?.lowStock || 0);
      const alertsList = [];
      if (outOfStock > 0) alertsList.push({
        id: 'out-of-stock',
        type: 'danger',
        title: 'Stock Alert',
        message: `${outOfStock} products are completely out of stock`,
        action: 'View Inventory',
        actionUrl: '/inventory?filter=outOfStock'
      });
      if (lowStock > 0) alertsList.push({
        id: 'low-stock',
        type: 'warning',
        title: 'Low Stock Warning',
        message: `${lowStock} products have low stock levels`,
        action: 'Restock Items',
        actionUrl: '/inventory?filter=lowStock'
      });
      if (alertsList.length === 0) alertsList.push({
        id: 'all-good',
        type: 'success',
        title: 'Inventory Status',
        message: 'All products have adequate stock levels',
        action: 'View Reports',
        actionUrl: '/statistical-reports'
      });
      setAlerts(alertsList);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlertAction = (alert) => {
    if (alert.actionUrl) {
      navigate(alert.actionUrl);
    }
  };

  const handleRestockItems = () => navigate('/inventory?filter=lowStock');

  const getRangeLabel = () => {
    switch (selectedRange) {
      case 'daily': return 'Today';
      case 'weekly': return '7 Days';
      case 'monthly': return '30 Days';
      case 'all': return 'All Time';
      default: return '7 Days';
    }
  };

  const getCurrentPeriodData = () => {
    return {
      sales: salesMetrics.periodRevenue || 0,
      growth: salesMetrics.periodGrowth || 0,
      period: getRangeLabel(),
    };
  };

  const formatPercent = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0.0%';
    const rounded = Math.round(numeric * 10) / 10;
    return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
  };

  // --- Chart Data Preparation ---
  const chartData = useMemo(() => {
    const dates = (salesTrendData || []).map((item) =>
      new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    );
    const sales = (salesTrendData || []).map((item) => Number(item.total || item.sales || 0));

    const gridColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const textColor = isDarkMode ? '#94a3b8' : '#64748b';

    return {
      lineData: {
        labels: dates,
        datasets: [{
          label: 'Sales',
          data: sales,
          borderColor: '#8b5cf6', // purple-500
          backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#8b5cf6',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3
        }]
      },
      doughnutData: {
        labels: topProducts.map(p => p.name),
        datasets: [{
          data: topProducts.map(p => p.revenue),
          backgroundColor: [
            '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'
          ],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index', intersect: false,
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            titleColor: isDarkMode ? '#fff' : '#000',
            bodyColor: isDarkMode ? '#e2e8f0' : '#334155',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            padding: 12,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 14 },
            callbacks: { label: (context) => `₱${context.parsed.y.toLocaleString()}` }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
          y: {
            grid: { color: gridColor, drawBorder: false },
            ticks: { color: textColor, font: { size: 11 }, callback: (value) => '₱' + value.toLocaleString() },
            beginAtZero: true
          }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
      }
    };
  }, [salesTrendData, topProducts, isDarkMode]);


  if (isLoading) {
    return (
      <LazyPageLoader
        title="Loading dashboard"
        subtitle="Crunching summary metrics and charts..."
        rows={4}
        centered
      />
    );
  }

  const currentPeriodData = getCurrentPeriodData();

  const getValueFontSize = (val) => {
    const s = String(val);
    if (s.length > 14) return 'text-xl';
    if (s.length > 11) return 'text-2xl';
    return 'text-3xl';
  };

  const StatCard = ({ title, value, icon: Icon, color, trend, trendValue, description, onClick }) => (
    <div
      onClick={onClick}
      className={`relative overflow-hidden ${colors.card.primary} rounded-2xl p-5 shadow-sm border ${colors.border.primary} transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 group' : ''}`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-[var(--tw-gradient-stops)] opacity-10 rounded-bl-full transition-transform duration-500 group-hover:scale-110" style={{ '--tw-gradient-stops': color }}></div>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${colors.text.secondary} mb-1 truncate`}>{title}</p>
          <p className={`${getValueFontSize(value)} font-bold ${colors.text.primary} tracking-tight mb-2 truncate`}>{value}</p>
          <div className="flex items-center space-x-2">
            {trend && (
              <span className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${trend === 'up' ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30' : trend === 'down' ? 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30' : 'text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800'}`}>
                {trend === 'up' ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : trend === 'down' ? <ArrowDownIcon className="h-3 w-3 mr-1" /> : <MinusIcon className="h-3 w-3 mr-1" />}
                {trendValue}
              </span>
            )}
            {description && <span className={`text-xs ${colors.text.tertiary} truncate`}>{description}</span>}
          </div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex-shrink-0 ml-2" style={{ color }}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Date Range Toggle */}
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Overview</h2>
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {[
            { key: 'daily', label: 'Today' },
            { key: 'weekly', label: '7 Days' },
            { key: 'monthly', label: '30 Days' },
            { key: 'all', label: 'All' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedRange(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${selectedRange === key ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-5">
        <StatCard
          title={`${currentPeriodData.period} Revenue`}
          value={`₱${currentPeriodData.sales.toLocaleString()}`}
          icon={CurrencyDollarIcon}
          color="#8b5cf6" // purple
          trend={currentPeriodData.growth > 0 ? 'up' : currentPeriodData.growth < 0 ? 'down' : (selectedRange === 'all' ? null : 'equal')}
          trendValue={formatPercent(currentPeriodData.growth)}
          description={selectedRange === 'all' ? 'All time' : 'vs prev period'}
        />
        <StatCard
          title={`${currentPeriodData.period} Total Cost`}
          value={`₱${(salesMetrics.currentPeriodCost || 0).toLocaleString()}`}
          icon={ChartBarIcon}
          color="#f59e0b" // amber
          description="COGS"
        />
        <StatCard
          title="Total Sales"
          value={(salesMetrics.periodTransactions ?? salesMetrics.totalTransactions ?? 0).toLocaleString()}
          icon={ShoppingBagIcon}
          color="#3b82f6" // blue
          description={getRangeLabel()}
          onClick={() => navigate('/sales')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Sales Chart */}
        <div className={`lg:col-span-2 ${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-5 flex flex-col`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-lg font-bold ${colors.text.primary}`}>Sales Overview</h3>
              <p className={`text-sm ${colors.text.secondary}`}>Revenue generated over time</p>
            </div>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setSelectedPeriod('weekly')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${selectedPeriod === 'weekly' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                7 Days
              </button>
              <button
                onClick={() => setSelectedPeriod('monthly')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${selectedPeriod === 'monthly' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                30 Days
              </button>
            </div>
          </div>
          <div className="flex-1 w-full relative" style={{ minHeight: '300px' }}>
            <Line data={chartData.lineData} options={chartData.options} />
          </div>
        </div>

        {/* Right side: Top Products & Alerts */}
        <div className="space-y-6 flex flex-col">
          {/* Top Products Doughnut */}
          <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${colors.text.primary}`}>Top Products Sold ({getRangeLabel()})</h3>
              <button className="text-purple-600 dark:text-purple-400 hover:text-purple-700 text-sm font-semibold flex items-center gap-1" onClick={() => navigate('/statistical-reports')}>
                View All <ArrowTrendingUpIcon className="w-4 h-4" />
              </button>
            </div>
            {topProducts.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className={`text-sm ${colors.text.secondary}`}>No sales data</p>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-28 h-28 flex-shrink-0 relative">
                  <Doughnut data={chartData.doughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' } }, cutout: '75%' }} />
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  {topProducts.slice(0, 3).map((p, i) => (
                    <div key={p.id} className="flex justify-between items-center overflow-hidden gap-2">
                      <div className="flex items-center gap-2 overflow-hidden min-w-0 pr-2 flex-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: chartData.doughnutData.datasets[0].backgroundColor[i] }}></span>
                        <p className={`text-sm font-medium ${colors.text.primary} truncate`}>{p.name}</p>
                      </div>
                      <p className={`text-sm font-semibold ${colors.text.secondary} flex-shrink-0`}>₱{p.revenue.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* System Alerts */}
          <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-5 flex-1`}>
            <h3 className={`text-lg font-bold ${colors.text.primary} mb-4`}>System Alerts</h3>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <p className={`text-sm ${colors.text.secondary}`}>No active alerts.</p>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border ${alert.type === 'danger' ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : alert.type === 'warning' ? 'bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30' : 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30'}`}>
                    <div className="mt-0.5">
                      {alert.type === 'danger' ? <ExclamationTriangleIcon className="w-5 h-5 text-red-500" /> : alert.type === 'warning' ? <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" /> : <CubeIcon className="w-5 h-5 text-emerald-500" />}
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${alert.type === 'danger' ? 'text-red-800 dark:text-red-400' : alert.type === 'warning' ? 'text-amber-800 dark:text-amber-400' : 'text-emerald-800 dark:text-emerald-400'}`}>{alert.title}</h4>
                      <p className={`text-xs mt-0.5 mb-2 ${alert.type === 'danger' ? 'text-red-600 dark:text-red-500' : alert.type === 'warning' ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-600 dark:text-emerald-500'}`}>{alert.message}</p>
                      <button onClick={() => handleAlertAction(alert)} className={`text-xs font-semibold hover:underline ${alert.type === 'danger' ? 'text-red-700 dark:text-red-400' : alert.type === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {alert.action} &rarr;
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50">
          <div>
            <h3 className={`text-lg font-bold ${colors.text.primary}`}>Recent Transactions</h3>
            <p className={`text-sm ${colors.text.secondary}`}>Latest sales activity</p>
          </div>
          <Link to="/sales" className="px-3 py-1.5 hidden sm:flex text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors gap-2 items-center">
            View Complete Ledger <ArrowTrendingUpIcon className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <DocumentTextIcon className={`h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600`} />
              <p className={`text-sm font-medium ${colors.text.primary}`}>No transactions found</p>
              <p className={`text-xs ${colors.text.secondary} mt-1`}>Sales will appear here automatically</p>
            </div>
          ) : (
            recentTransactions.map(tx => (
              <div key={tx.id} className="p-4 flex flex-wrap gap-4 items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <ShoppingBagIcon className={`w-5 h-5 ${colors.text.secondary}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${colors.text.primary}`}>{tx.productName} {tx.items > 1 && <span className="text-xs font-normal text-slate-500 ml-1">+{tx.items - 1} more items</span>}</p>
                    <p className={`text-xs ${colors.text.secondary} flex items-center gap-1 mt-0.5`}><CalendarIcon className="w-3 h-3" /> {tx.date} at {tx.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-base font-bold text-slate-900 dark:text-white`}>₱{tx.amount.toLocaleString()}</p>
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    COMPLETED
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/20 text-center sm:hidden">
          <Link to="/sales" className={`text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700`}>
            View All Sales
          </Link>
        </div>
      </div>

    </div>
  );
};

export default DashboardScreen;