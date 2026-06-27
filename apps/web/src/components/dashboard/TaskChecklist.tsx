"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useNextSteps } from "@/hooks/dashboard/useNextSteps";

interface TaskChecklistProps {
  tenantId: string;
}

export default function TaskChecklist({ tenantId }: TaskChecklistProps) {
  const { tasks, loading } = useNextSteps(tenantId);

  const completed = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (loading && tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-1">Next Steps</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-1">Next Steps</h3>
      <p className="text-sm text-gray-500 mb-4">
        {completed} of {total} completed
      </p>

      {/* Progress ring */}
      <div className="flex items-center justify-center mb-5">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-gray-100"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
            />
            <path
              className="text-blue-600"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeDasharray={`${percent}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-900">{percent}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={task.link}
            className={`flex items-center gap-3 group ${
              !task.done && task.priority === "critical"
                ? "p-2 -mx-2 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100"
                : ""
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${task.done ? "bg-emerald-500" : "border-2 border-gray-200 group-hover:border-blue-400"
                }`}
            >
              {task.done && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <span
              className={`text-sm transition-colors ${task.done
                ? "text-gray-400 line-through"
                : "text-gray-700 group-hover:text-blue-600"
                }`}
            >
              {task.label}
            </span>
            {!task.done && task.priority === "critical" && (
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 ml-auto" />
            )}
          </Link>
        ))}
      </div>

      <Link
        href={`/t/${tenantId}/settings`}
        className="mt-4 inline-flex items-center text-sm text-blue-600 font-medium hover:underline"
      >
        View all tasks <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Link>
    </div>
  );
}
