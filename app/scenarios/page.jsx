'use client';
import { useState } from 'react';
import CCLayout from '@/components/command-center/CCLayout';
import ScenarioRunner from '@/components/scenarios/ScenarioRunner';
import { scenarioTypes } from '@/data/mock/scenarios';
import { Zap, Thermometer, Network, AlertTriangle, Shield } from 'lucide-react';

const ICONS = { Zap, Thermometer, Network, AlertTriangle, Shield };

export default function ScenariosPage() {
  const [selectedType, setSelectedType] = useState(null);

  return (
    <CCLayout title="Scenario Simulator">
      <div className="flex h-full">
        {/* Left: scenario type picker */}
        <div className="flex-shrink-0 w-72 border-r border-[#D8DCE3] flex flex-col bg-white">
          <div className="flex-shrink-0 px-4 py-4 border-b border-[#D8DCE3]">
            <h2 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
              Failure Scenarios
            </h2>
            <p className="text-[10px] text-[#9CA3AF] mt-0.5 leading-relaxed">
              Run virtual failure simulations to test resilience before real incidents occur.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {scenarioTypes.map(type => {
              const Icon = ICONS[type.icon] || AlertTriangle;
              const isSelected = selectedType?.id === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-transparent shadow-md'
                      : 'border-[#D8DCE3] hover:border-[#D1D5DB] hover:bg-[#F8FAFC]'
                  }`}
                  style={isSelected ? { backgroundColor: type.color + '12', borderColor: type.color + '40' } : {}}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: type.color + '20' }}>
                      <Icon size={15} style={{ color: type.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                        {type.label}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF] mt-0.5 leading-relaxed">{type.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info banner */}
          <div className="flex-shrink-0 m-3 p-3 bg-[#EFF6FF] border border-[#005EB8]/20 rounded-xl">
            <p className="text-[10px] text-[#005EB8] font-medium leading-relaxed">
              Simulations run on pre-computed models. No live systems are affected. Results include AI-generated mitigation recommendations.
            </p>
          </div>
        </div>

        {/* Right: runner */}
        <div className="flex-1 overflow-hidden">
          {selectedType ? (
            <ScenarioRunner scenarioType={selectedType} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-[#F0F2F5] flex items-center justify-center mb-4">
                <Shield size={28} className="text-[#D1D5DB]" />
              </div>
              <h3 className="text-base font-bold text-[#1A1F36] mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                Select a Scenario
              </h3>
              <p className="text-sm text-[#9CA3AF] max-w-xs leading-relaxed">
                Choose a failure type from the left panel to configure and run a virtual simulation against any datacenter.
              </p>
            </div>
          )}
        </div>
      </div>
    </CCLayout>
  );
}
