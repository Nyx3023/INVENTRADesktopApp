import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { inventoryBatchService } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import LazyPageLoader from '../common/LazyPageLoader';
import { exportToCSV } from '../../utils/exportUtils';
import { toast } from 'react-hot-toast';

const BatchManagementScreen = () => {
  const { colors } = useTheme();
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering and Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const data = await inventoryBatchService.getAll();
      setBatches(data || []);
    } catch (error) {
      console.error('Failed to load inventory batches:', error);
      toast.error('Failed to load batches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  // Filter and paginate
  const filteredBatches = batches.filter(batch => {
    const searchMatch = 
      (batch.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (batch.batchNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const statusMatch = statusFilter === 'all' || batch.status === statusFilter;
    
    return searchMatch && statusMatch;
  });

  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const paginatedBatches = filteredBatches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const columns = [
      { header: 'Product Name', accessor: 'productName' },
      { header: 'Category', accessor: 'categoryName' },
      { header: 'Batch Number', accessor: 'batchNumber' },
      { header: 'Quantity', accessor: 'quantity' },
      { header: 'Unit Cost', accessor: (row) => Number(row.unitCost || 0).toFixed(2) },
      { header: 'Expiry Date', accessor: (row) => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : 'N/A' },
      { header: 'Received Date', accessor: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : 'N/A' },
      { header: 'Status', accessor: 'status' }
    ];
    
    exportToCSV(filteredBatches, columns, 'Inventory_Batches');
    toast.success('Batches exported successfully');
  };

  if (isLoading) {
    return (
      <LazyPageLoader 
        title="Loading Batches" 
        subtitle="Fetching inventory batch records..." 
        rows={5} 
        centered 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
          <div className="flex-1 max-w-md lg:mr-4">
            <div className="relative">
              <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${colors.text.tertiary}`} />
              <input
                type="text"
                placeholder="Search by product or batch number..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all duration-200 ${colors.input.primary}`}
              />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <FunnelIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${colors.text.tertiary}`} />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={`pl-9 pr-8 py-2.5 rounded-xl border text-sm font-medium ${colors.input.primary} appearance-none cursor-pointer`}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="depleted">Depleted</option>
              </select>
            </div>
            
            <button
              onClick={loadBatches}
              className={`p-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${colors.bg.secondary} hover:${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
              title="Refresh"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleExport}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Product Name</th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Batch Number</th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Quantity</th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Unit Cost</th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Expiry Date</th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Received</th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Status</th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {paginatedBatches.length === 0 ? (
                <tr>
                  <td colSpan="7" className={`px-6 py-8 text-center text-sm ${colors.text.tertiary}`}>
                    No batches found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((batch) => (
                  <tr key={batch.id} className={`hover:${colors.bg.secondary} transition-colors`}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                      {batch.productName || 'Unknown Product'}
                      <div className={`text-xs ${colors.text.tertiary}`}>{batch.categoryName || 'Uncategorized'}</div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      {batch.batchNumber || <span className="italic text-gray-400">N/A</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        batch.quantity > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {batch.quantity}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                      {formatCurrency(parseFloat(batch.unitCost || 0))}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        batch.status === 'active' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {(batch.status || 'unknown').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`px-6 py-4 border-t ${colors.border.primary} flex items-center justify-between`}>
            <div className={`text-sm ${colors.text.secondary}`}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredBatches.length)} of {filteredBatches.length} batches
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : `hover:${colors.bg.secondary}`}`}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <div className={`text-sm font-medium ${colors.text.primary}`}>
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : `hover:${colors.bg.secondary}`}`}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchManagementScreen;
