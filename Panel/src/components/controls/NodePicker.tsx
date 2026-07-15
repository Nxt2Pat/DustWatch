import { useState, useRef, useEffect } from 'react';

interface NodePickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  nodes: string[];
}

export default function NodePicker({ selected, onChange, nodes }: NodePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (nodeId: string) => {
    if (selected.includes(nodeId)) {
      onChange(selected.filter((id) => id !== nodeId));
    } else {
      onChange([...selected, nodeId]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === nodes.length) {
      onChange([]);
    } else {
      onChange([...nodes]);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 text-xs font-bold text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          <span>Select Stations ({selected.length})</span>
          <span className="text-[10px] text-gray-500">▼</span>
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-white/5 bg-[#0a0d16] shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
          <div className="p-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stations</span>
            <button
              onClick={handleSelectAll}
              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              {selected.length === nodes.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
            {nodes.map((nodeId) => {
              const isChecked = selected.includes(nodeId);
              return (
                <button
                  key={nodeId}
                  onClick={() => handleToggle(nodeId)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Controlled via button click
                    className="h-3.5 w-3.5 rounded border-white/10 bg-transparent text-blue-500 focus:ring-0 focus:ring-offset-0 pointer-events-none"
                  />
                  <span className="font-mono">{nodeId}</span>
                </button>
              );
            })}
            
            {nodes.length === 0 && (
              <div className="p-3 text-center text-xs text-gray-500">
                No stations available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
