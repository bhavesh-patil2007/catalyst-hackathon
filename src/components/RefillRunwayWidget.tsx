"use client";

import React from "react";
import { AlertCircle, Calendar, CheckCircle2, PackageCheck, AlertTriangle } from "lucide-react";
import { RefillRunway } from "@/types";

interface RefillRunwayWidgetProps {
  runways: RefillRunway[];
}

export function RefillRunwayWidget({ runways }: RefillRunwayWidgetProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-900 font-serif flex items-center space-x-2">
            <PackageCheck className="w-4 h-4 text-emerald-700" />
            <span>Refill Runway & Inventory Aid</span>
          </h3>
          <p className="text-[11px] text-gray-400">
            Estimates likely run-out dates based on daily schedule • Verify with pharmacy
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {runways.map((item) => (
          <div
            key={item.medicationId}
            className={`p-3 rounded-xl border transition-colors ${
              item.isLowStock
                ? "bg-amber-50/60 border-amber-200"
                : "bg-gray-50 border-gray-100"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="text-gray-900">{item.medicationName}</span>
              {item.isLowStock ? (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full inline-flex items-center space-x-1 border border-amber-300">
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  <span>Refill Needed Soon</span>
                </span>
              ) : (
                <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                  {item.daysRemaining} days remaining
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 mt-2">
              <div>
                <span className="text-gray-400 block">Remaining Stock:</span>
                <span className="font-bold text-gray-800">{item.remainingQuantity} doses</span>
              </div>
              <div>
                <span className="text-gray-400 block">Est. Run-Out Date:</span>
                <span className={`font-bold ${item.isLowStock ? "text-amber-800" : "text-gray-800"}`}>
                  {item.estimatedRunOutDate}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[10px] text-gray-400 text-center italic">
        Inventory aid only; not a clinical or purchasing instruction.
      </div>
    </div>
  );
}
