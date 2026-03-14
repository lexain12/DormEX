import { useState } from 'react';
import { TopNav } from '@/components/TopNav';
import { FeaturedCard } from '@/components/FeaturedCard';
import { TaskCard } from '@/components/TaskCard';
import { RightSidebar } from '@/components/RightSidebar';
import { CategoryChips } from '@/components/CategoryChips';
import { CreateRequestModal } from '@/components/CreateRequestModal';
import { SAMPLE_TASKS } from '@/lib/data';

const Index = () => {
  const [category, setCategory] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = category === 'all'
    ? SAMPLE_TASKS
    : SAMPLE_TASKS.filter(t => t.category === category);

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Main */}
          <div className="flex-1 min-w-0 space-y-5">
            <FeaturedCard />

            <CategoryChips active={category} onChange={setCategory} />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.slice(1).map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <RightSidebar />
        </div>
      </div>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default Index;
