import React, { useEffect, useState } from 'react';
import { usePlanningStore } from '../../store/planningStore';
import { useChatStore } from '../../store/chatStore';
import type { Plan, PlanItem } from '../../../shared/types';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import ChatPanel from '../../components/chat/ChatPanel';
import { v4 as uuidv4 } from 'uuid';

const typeTabs: Array<{ type: Plan['type']; label: string }> = [
  { type: 'today', label: 'Today' },
  { type: 'short-term', label: 'Short Term' },
  { type: 'long-term', label: 'Long Term' },
];

const priorityColors: Record<string, string> = {
  high: 'text-void-error',
  medium: 'text-void-warning',
  low: 'text-void-secondary',
};

const PlanningMode: React.FC = () => {
  const plans = usePlanningStore((s) => s.plans);
  const activePlanId = usePlanningStore((s) => s.activePlanId);
  const activeType = usePlanningStore((s) => s.activeType);
  const isChatOpen = usePlanningStore((s) => s.isChatOpen);
  const fetchPlans = usePlanningStore((s) => s.fetchPlans);
  const createPlan = usePlanningStore((s) => s.createPlan);
  const deletePlan = usePlanningStore((s) => s.deletePlan);
  const addItem = usePlanningStore((s) => s.addItem);
  const toggleItem = usePlanningStore((s) => s.toggleItem);
  const deleteItem = usePlanningStore((s) => s.deleteItem);
  const updateItem = usePlanningStore((s) => s.updateItem);
  const setActivePlan = usePlanningStore((s) => s.setActivePlan);
  const setActiveType = usePlanningStore((s) => s.setActiveType);
  const setChatOpen = usePlanningStore((s) => s.setChatOpen);

  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newItemContent, setNewItemContent] = useState('');

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const filteredPlans = plans.filter(p => p.type === activeType);
  const activePlan = plans.find(p => p.id === activePlanId);

  const handleCreatePlan = async () => {
    if (!newPlanTitle.trim()) return;
    await createPlan(activeType, newPlanTitle.trim());
    setNewPlanTitle('');
    setShowNewPlan(false);
  };

  const handleAddItem = async () => {
    if (!newItemContent.trim() || !activePlanId) return;
    await addItem(activePlanId, newItemContent.trim());
    setNewItemContent('');
  };

  return (
    <div className="flex h-full">
      {/* Plan List Sidebar */}
      <div className="w-60 shrink-0 border-r border-void-border bg-void-surface flex flex-col">
        {/* Type tabs */}
        <div className="flex border-b border-void-border">
          {typeTabs.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setActiveType(tab.type)}
              className={`
                flex-1 py-2.5 text-xs font-medium transition-colors border-b-2
                ${activeType === tab.type
                  ? 'border-void-accent text-void-text'
                  : 'border-transparent text-void-secondary hover:text-void-text'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Plan list */}
        <div className="flex-1 overflow-y-auto py-1">
          {filteredPlans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setActivePlan(plan.id)}
              className={`
                w-full px-3 py-2.5 text-left text-sm transition-colors border-l-2
                ${plan.id === activePlanId
                  ? 'bg-void-accent/10 text-void-text border-void-accent'
                  : 'border-transparent text-void-secondary hover:text-void-text hover:bg-void-border/10'
                }
              `}
            >
              <div className="truncate">{plan.title}</div>
              <div className="text-2xs text-void-muted">
                {plan.items.filter(i => i.completed).length}/{plan.items.length} done
              </div>
            </button>
          ))}
        </div>

        {/* New plan button */}
        <div className="border-t border-void-border p-2">
          {showNewPlan ? (
            <div className="flex gap-1">
              <input
                type="text"
                value={newPlanTitle}
                onChange={(e) => setNewPlanTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlan()}
                placeholder="Plan title..."
                className="flex-1 rounded border border-void-border bg-void-bg px-2 py-1 text-xs text-void-text placeholder:text-void-muted focus:border-void-accent focus:outline-none"
                autoFocus
              />
              <Button size="sm" onClick={handleCreatePlan}>Add</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowNewPlan(true)}>
              + New Plan
            </Button>
          )}
        </div>
      </div>

      {/* Plan Detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activePlan ? (
          <>
            {/* Plan header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-void-border">
              <h2 className="text-sm font-medium text-void-text">{activePlan.title}</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setChatOpen(!isChatOpen)}
                >
                  {isChatOpen ? 'Hide AI' : 'Ask AI'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deletePlan(activePlan.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </Button>
              </div>
            </div>

            {/* Items + optional chat */}
            <div className="flex-1 flex overflow-hidden">
              {/* Items list */}
              <div className={`flex-1 overflow-y-auto p-4 ${isChatOpen ? 'border-r border-void-border' : ''}`}>
                {activePlan.items.length === 0 ? (
                  <p className="text-sm text-void-secondary text-center py-8">No items yet. Add one below.</p>
                ) : (
                  <div className="space-y-2">
                    {activePlan.items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 rounded border p-3 transition-colors ${
                          item.completed
                            ? 'border-void-border/50 bg-transparent opacity-60'
                            : 'border-void-border bg-void-bg hover:border-void-border/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleItem(activePlan.id, item.id)}
                          className="mt-0.5 accent-void-accent"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${item.completed ? 'line-through text-void-muted' : 'text-void-text'}`}>
                            {item.content}
                          </p>
                          {item.aiNote && (
                            <p className="text-xs text-void-accent mt-1 italic">{item.aiNote}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <select
                            value={item.priority}
                            onChange={(e) => updateItem(activePlan.id, item.id, { priority: e.target.value as PlanItem['priority'] })}
                            className={`rounded border border-void-border bg-void-surface px-1.5 py-0.5 text-2xs ${priorityColors[item.priority]} focus:outline-none appearance-none cursor-pointer`}
                            style={{ colorScheme: 'dark' }}
                          >
                            <option value="high" className="bg-void-surface text-void-error">High</option>
                            <option value="medium" className="bg-void-surface text-void-warning">Medium</option>
                            <option value="low" className="bg-void-surface text-void-secondary">Low</option>
                          </select>
                          <button
                            onClick={() => deleteItem(activePlan.id, item.id)}
                            className="text-void-muted hover:text-void-error"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add item */}
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={newItemContent}
                    onChange={(e) => setNewItemContent(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    placeholder="Add new item..."
                    className="flex-1 rounded border border-void-border bg-void-bg px-3 py-2 text-sm text-void-text placeholder:text-void-muted focus:border-void-accent focus:outline-none"
                  />
                  <Button size="sm" onClick={handleAddItem}>Add</Button>
                </div>
              </div>

              {/* AI Chat Panel */}
              {isChatOpen && (
                <div className="w-80 shrink-0">
                  <ChatPanel mode="planning" placeholder="Ask AI about your plans..." showConversationList={false} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-void-secondary">
            Select a plan or create a new one
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanningMode;
