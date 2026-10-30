'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Shield, 
  X, 
  Check,
  Filter,
} from 'lucide-react';
import { Permission } from '@/lib/api/permissions';

interface AdvancedPermissionsSelectorProps {
  permissions: Permission[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}

const OPERATION_COLUMNS = [
  { key: 'View', label: 'View', matches: ['View', 'Read', 'List', 'Get'] },
  { key: 'Create', label: 'Create', matches: ['Create', 'Add'] },
  { key: 'Edit', label: 'Edit', matches: ['Update', 'Edit', 'Change'] },
  { key: 'Delete', label: 'Delete', matches: ['Delete', 'Remove'] },
  { key: 'Approve', label: 'Approve', matches: ['Approve'] },
  { key: 'Reject', label: 'Reject', matches: ['Reject'] },
  { key: 'Print', label: 'Print', matches: ['Print'] },
  { key: 'Export', label: 'Export', matches: ['Export'] },
  { key: 'Import', label: 'Import', matches: ['Import'] },
  { key: 'Execute', label: 'Execute', matches: ['Execute', 'Run'] },
  { key: 'Generate', label: 'Generate', matches: ['Generate'] },
  { key: 'Lock', label: 'Lock', matches: ['Lock', 'Unlock'] },
  { key: 'Back Date', label: 'Back Date', matches: ['AllowBackDate', 'Allow Back Date', 'Back Date', 'BackDate'] },
  { key: 'Future Date', label: 'Future Date', matches: ['AllowFutureDate', 'Allow Future Date', 'Future Date', 'FutureDate'] },
];

interface EntityPermissions {
  entityName: string;
  permissions: Record<string, Permission>; // key is operation key
  allPermissionIds: string[];
}

interface ModuleGroup {
  moduleName: string;
  entities: EntityPermissions[];
  allPermissionIds: string[];
}

export default function AdvancedPermissionsSelector({
  permissions,
  selectedIds,
  onChange,
}: AdvancedPermissionsSelectorProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Group permissions by module and then by entity
  const groupedData = useMemo(() => {
    const sections: Record<string, Record<string, EntityPermissions>> = {};

    permissions.forEach((perm) => {
      // Split module name: "ADMINISTRATOR - APPROVALS" -> "Administrator", "Approvals"
      let sectionName = perm.module;
      let pageHint = '';
      
      if (perm.module.includes(' - ')) {
        const parts = perm.module.split(' - ');
        sectionName = parts[0].trim();
        pageHint = parts[1].trim();
      }

      // Format section name (Title Case)
      sectionName = sectionName.charAt(0).toUpperCase() + sectionName.slice(1).toLowerCase();

      // Map sub-modules to main sections
      const sectionMapping: Record<string, string> = {
        'Dms': 'DMS',
        'Admin': 'Administrator',
        'Showroom': 'Showrooms',
        'Unit-of-measure': 'Inventory',
        'Ingredients': 'Inventory',
        'Products': 'Inventory',
        'Categories': 'Inventory',
        'Inventory': 'Inventory',
        'Production-daily': 'Production',
        'Production-plan': 'Production',
        'Production-approvals': 'Production',
        'Production-cancel': 'Production',
        'Production-current-stock': 'Production',
        'Production-stock-adjustment': 'Production',
        'Operation-delivery': 'Operation',
        'Operation-approvals': 'Operation',
        'Operation-disposal': 'Operation',
        'Operation-transfer': 'Operation',
        'Operation-stock-bf': 'Operation',
        'Operation-cancellation': 'Operation',
        'Operation-delivery-return': 'Operation',
        'Operation-label-printing': 'Operation',
        'Operation-showroom-label-printing': 'Operation',
        'Operation-pos-sales': 'Administrator',
      };

      if (sectionMapping[sectionName]) {
        sectionName = sectionMapping[sectionName];
      }

      // Extract operation and entity
      let operationKey = 'Other';
      let entityName = perm.name;

      for (const op of OPERATION_COLUMNS) {
        for (const match of op.matches) {
          if (perm.name.toLowerCase().startsWith(match.toLowerCase())) {
            operationKey = op.key;
            entityName = perm.name.substring(match.length).trim();
            break;
          }
        }
        if (operationKey !== 'Other') break;
      }

      // If we have a page hint from the module name, use it if entityName is too generic
      if (pageHint && (entityName.length < 3 || entityName.toLowerCase() === 'all' || entityName.toLowerCase() === 'permission')) {
        entityName = pageHint;
      }

      // Cleanup entity name (Title Case)
      if (entityName.toUpperCase() === entityName) {
        entityName = entityName.charAt(0).toUpperCase() + entityName.slice(1).toLowerCase();
      }

      if (!sections[sectionName]) {
        sections[sectionName] = {};
      }

      if (!sections[sectionName][entityName]) {
        sections[sectionName][entityName] = {
          entityName,
          permissions: {},
          allPermissionIds: [],
        };
      }

      sections[sectionName][entityName].permissions[operationKey] = perm;
      sections[sectionName][entityName].allPermissionIds.push(perm.id);
    });

    const result: ModuleGroup[] = Object.entries(sections).map(([moduleName, entitiesMap]) => {
      const entities = Object.values(entitiesMap).sort((a, b) => a.entityName.localeCompare(b.entityName));
      const allPermissionIds = entities.flatMap(e => e.allPermissionIds);
      return {
        moduleName,
        entities,
        allPermissionIds,
      };
    }).sort((a, b) => a.moduleName.localeCompare(b.moduleName));

    return result;
  }, [permissions]);

  const didApplyDefaultExpand = useRef(false);
  useEffect(() => {
    if (didApplyDefaultExpand.current || groupedData.length === 0) return;
    didApplyDefaultExpand.current = true;
    setExpandedModules(new Set(groupedData.slice(0, 3).map((m) => m.moduleName)));
  }, [groupedData]);

  // Filter based on search
  const filteredData = useMemo(() => {
    if (!searchTerm) return groupedData;

    const term = searchTerm.toLowerCase();
    return groupedData.map(module => {
      const filteredEntities = module.entities.filter(entity => 
        entity.entityName.toLowerCase().includes(term) ||
        Object.values(entity.permissions).some(p => 
          p.name.toLowerCase().includes(term) || 
          p.code.toLowerCase().includes(term)
        )
      );

      if (filteredEntities.length === 0) return null;

      return {
        ...module,
        entities: filteredEntities,
        allPermissionIds: filteredEntities.flatMap(e => e.allPermissionIds)
      };
    }).filter((m): m is ModuleGroup => m !== null);
  }, [groupedData, searchTerm]);

  const totalPermissions = permissions.length;
  const selectedCount = selectedIds.length;
  const isSuperAdmin = selectedCount === totalPermissions && totalPermissions > 0;

  const toggleModule = (moduleName: string) => {
    const next = new Set(expandedModules);
    if (next.has(moduleName)) {
      next.delete(moduleName);
    } else {
      next.add(moduleName);
    }
    setExpandedModules(next);
  };

  const handleToggleAll = () => {
    if (isSuperAdmin) {
      onChange([]);
    } else {
      onChange(permissions.map(p => p.id));
    }
  };

  const togglePermission = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const toggleModuleAll = (moduleIds: string[]) => {
    const allSelected = moduleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter(id => !moduleIds.includes(id)));
    } else {
      const newSelected = [...selectedIds];
      moduleIds.forEach(id => {
        if (!newSelected.includes(id)) newSelected.push(id);
      });
      onChange(newSelected);
    }
  };

  const toggleEntityAll = (entityIds: string[]) => {
    const allSelected = entityIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter(id => !entityIds.includes(id)));
    } else {
      const newSelected = [...selectedIds];
      entityIds.forEach(id => {
        if (!newSelected.includes(id)) newSelected.push(id);
      });
      onChange(newSelected);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selection Stats Bar */}
      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Permissions Selected</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{selectedCount}</span>
              <span className="text-sm text-gray-400 font-medium">/ {totalPermissions} total</span>
            </div>
          </div>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="Filter by section, page or permission..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Super Admin Access Toggle */}
      <div 
        className={`group flex items-center justify-between p-6 rounded-xl border-2 transition-all cursor-pointer ${
          isSuperAdmin 
            ? 'bg-red-50 border-red-200 shadow-md' 
            : 'bg-white border-gray-100 hover:border-red-100 shadow-sm'
        }`}
        onClick={handleToggleAll}
      >
        <div className="flex items-center gap-4">
          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
            isSuperAdmin ? 'bg-red-600 border-red-600' : 'bg-white border-gray-300 group-hover:border-red-400'
          }`}>
            {isSuperAdmin && <Check className="w-4 h-4 text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Shield className={`w-5 h-5 ${isSuperAdmin ? 'text-red-600' : 'text-gray-400'}`} />
              <h4 className={`text-lg font-bold ${isSuperAdmin ? 'text-red-900' : 'text-gray-900'}`}>Super Admin Access</h4>
            </div>
            <p className={`text-sm mt-1 ${isSuperAdmin ? 'text-red-700' : 'text-gray-500'}`}>
              Grant all {totalPermissions} permissions to this role. This allows full access to every module and feature in the system.
            </p>
          </div>
        </div>
      </div>

      {/* Modules List */}
      <div className="space-y-4">
        {filteredData.map((module) => {
          const isExpanded = expandedModules.has(module.moduleName);
          const moduleSelectedCount = module.allPermissionIds.filter(id => selectedIds.includes(id)).length;
          const isAllModuleSelected = moduleSelectedCount === module.allPermissionIds.length && module.allPermissionIds.length > 0;
          const isPartialModuleSelected = moduleSelectedCount > 0 && !isAllModuleSelected;

          return (
            <div key={module.moduleName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Module Header */}
              <div 
                className="flex items-center justify-between p-4 bg-gray-50/80 cursor-pointer hover:bg-gray-100/80 transition-colors"
                onClick={() => toggleModule(module.moduleName)}
              >
                <div className="flex items-center gap-3">
                  <div className="text-gray-400">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-red-600" />
                    <h3 className="font-bold text-gray-900 uppercase tracking-wide">{module.moduleName}</h3>
                    <span className="text-xs font-medium text-gray-400 px-2 py-0.5 bg-gray-200 rounded-full">
                      {module.entities.length} pages
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs font-bold text-gray-700">{moduleSelectedCount}</span>
                    <span className="text-[10px] text-gray-400 uppercase">selected</span>
                  </div>
                  
                  <label 
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div 
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isAllModuleSelected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-300 group-hover:border-red-400'
                      }`}
                      onClick={() => toggleModuleAll(module.allPermissionIds)}
                    >
                      {isAllModuleSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      {!isAllModuleSelected && isPartialModuleSelected && <div className="w-2 h-0.5 bg-red-400 rounded-full" />}
                    </div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Select all</span>
                  </label>
                </div>
              </div>

              {/* Module Content - Grid Table */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/30 sticky left-0 z-10 w-64">Page / Feature</th>
                        {OPERATION_COLUMNS.map(col => (
                          <th key={col.key} className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center min-w-[80px]">
                            {col.label}
                          </th>
                        ))}
                        <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center min-w-[60px]">All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {module.entities.map((entity) => {
                        const entitySelectedCount = entity.allPermissionIds.filter(id => selectedIds.includes(id)).length;
                        const isAllEntitySelected = entitySelectedCount === entity.allPermissionIds.length && entity.allPermissionIds.length > 0;

                        return (
                          <tr key={entity.entityName} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 sticky left-0 bg-white/95 backdrop-blur-sm z-10">
                              <div className="font-semibold text-gray-900">{entity.entityName}</div>
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                /{module.moduleName.toLowerCase()}/{entity.entityName.toLowerCase().replace(/\s+/g, '-')}
                              </div>
                            </td>
                            {OPERATION_COLUMNS.map(col => {
                              const perm = entity.permissions[col.key];
                              if (!perm) return <td key={col.key} className="p-4"></td>;

                              const isChecked = selectedIds.includes(perm.id);

                              return (
                                <td key={col.key} className="p-4 text-center">
                                  <button
                                    onClick={() => togglePermission(perm.id)}
                                    className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center transition-all ${
                                      isChecked 
                                        ? 'bg-red-600 border-red-600 shadow-sm shadow-red-200' 
                                        : 'bg-white border-gray-200 hover:border-red-300'
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="p-4 text-center bg-gray-50/30">
                              <button
                                onClick={() => toggleEntityAll(entity.allPermissionIds)}
                                className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center transition-all ${
                                  isAllEntitySelected 
                                    ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' 
                                    : 'bg-white border-gray-300 hover:border-blue-300'
                                }`}
                              >
                                {isAllEntitySelected && <Check className="w-3.5 h-3.5 text-white" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {filteredData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No permissions found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search or filter terms</p>
            <button 
              onClick={() => setSearchTerm('')}
              className="mt-4 px-4 py-2 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
