"use client";

import React, { useState } from "react";
import { 
  Users, 
  Calendar, 
  Clock, 
  Brain, 
  Presentation, 
  Mic, 
  Target, 
  Send,
  Activity
} from "lucide-react";
import { useRouter } from "next/navigation";

// Mock candidates
const MOCK_CANDIDATES = [
  { id: "c1", name: "Alice Smith", email: "alice@example.com" },
  { id: "c2", name: "Bob Johnson", email: "bob@example.com" },
  { id: "c3", name: "Charlie Williams", email: "charlie@example.com" },
];

export default function NewSessionPage() {
  const router = useRouter();
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCandidate = (id: string) => {
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSchedule = async () => {
    if (selectedCandidates.length === 0 || !date || !time) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/hr/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateIds: selectedCandidates,
          scheduledDate: `${date}T${time}:00`,
          template: "RIGID_4_SEGMENT"
        })
      });
      
      alert("Invitations sent successfully!");
      router.push("/hr/sessions");
    } catch (error) {
      console.error(error);
      alert("Failed to schedule session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Schedule New Interview Session</h1>
          <p className="text-slate-500 mt-2 text-lg">Configure the candidate details and time for the standard 4-segment evaluation.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Configuration */}
          <div className="col-span-1 lg:col-span-1 space-y-6">
            
            {/* Candidates */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800">
                <Users className="w-5 h-5 text-indigo-500" />
                Select Candidates
              </h2>
              <div className="space-y-3">
                {MOCK_CANDIDATES.map(candidate => (
                  <label key={candidate.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer transition-all">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedCandidates.includes(candidate.id)}
                      onChange={() => toggleCandidate(candidate.id)}
                    />
                    <div>
                      <p className="font-medium text-slate-800">{candidate.name}</p>
                      <p className="text-sm text-slate-500">{candidate.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Date & Time */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-semibold mb-4 text-slate-800">Schedule</h2>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                    <Calendar className="w-4 h-4" /> Date
                  </label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                    <Clock className="w-4 h-4" /> Time
                  </label>
                  <input 
                    type="time" 
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleSchedule}
              disabled={isSubmitting || selectedCandidates.length === 0 || !date || !time}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl shadow-sm hover:shadow transition-all"
            >
              {isSubmitting ? (
                <Activity className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {isSubmitting ? "Scheduling..." : "Schedule & Send Invites"}
            </button>

          </div>

          {/* Right Column: Template Preview */}
          <div className="col-span-1 lg:col-span-2">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 h-full">
              <h2 className="text-2xl font-semibold mb-2 text-slate-800">Standard Evaluation Template</h2>
              <p className="text-slate-500 mb-8">This rigid 4-segment pipeline will be presented to the candidates sequentially.</p>

              <div className="relative">
                {/* Connecting Line */}
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-100"></div>

                <div className="space-y-8 relative">
                  {/* Segment 1 */}
                  <div className="flex gap-6 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 z-10 border-4 border-white shadow-sm group-hover:scale-110 transition-transform">
                      <Presentation className="w-6 h-6" />
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex-1 hover:border-blue-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Segment 1</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">Oral Introduction</h3>
                      <p className="text-slate-600 mt-2">
                        Communication Evaluation. The candidate records a brief introduction covering their background and key skills.
                      </p>
                    </div>
                  </div>

                  {/* Segment 2 */}
                  <div className="flex gap-6 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 z-10 border-4 border-white shadow-sm group-hover:scale-110 transition-transform">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex-1 hover:border-amber-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Segment 2</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">Cognitive Speed Test</h3>
                      <p className="text-slate-600 mt-2">
                        20 random MCQs assessing Logical, Perceptual, Numerical, and Verbal reasoning.
                      </p>
                      <div className="flex items-center gap-2 mt-3 text-sm font-medium text-amber-600 bg-amber-50 w-fit px-3 py-1 rounded-full">
                        <Clock className="w-4 h-4" /> 5 Min Timer
                      </div>
                    </div>
                  </div>

                  {/* Segment 3 */}
                  <div className="flex gap-6 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 z-10 border-4 border-white shadow-sm group-hover:scale-110 transition-transform">
                      <Target className="w-6 h-6" />
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex-1 hover:border-emerald-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Segment 3</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">Psychometric Test</h3>
                      <p className="text-slate-600 mt-2">
                        10 random MCQs formatted on a Likert Scale. Evaluates personality traits and cultural fit.
                      </p>
                    </div>
                  </div>

                  {/* Segment 4 */}
                  <div className="flex gap-6 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 z-10 border-4 border-white shadow-sm group-hover:scale-110 transition-transform">
                      <Mic className="w-6 h-6" />
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex-1 hover:border-purple-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-purple-500 uppercase tracking-wider">Segment 4</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">Oral Aspirations Transcript</h3>
                      <p className="text-slate-600 mt-2">
                        The candidate records their future aspirations, career goals, and what they are looking for in the role.
                      </p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
