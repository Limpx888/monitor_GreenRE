import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, CalendarDays, Clock, Users, Coffee, Projector, 
  MonitorPlay, Mic2, LayoutTemplate, PlusCircle, CheckCircle2, 
  FileText, Download, Menu
} from 'lucide-react';

export default function ReservationPage() {
  const [view, setView] = useState('customer'); // 'customer' | 'admin'
  const [spaceType, setSpaceType] = useState('ballroom'); // 'stay' | 'meeting' | 'ballroom'
  const [layout, setLayout] = useState('banquet');
  const [addons, setAddons] = useState({ coffee: true, projector: false, mic: true });

  const toggleAddon = (key) => setAddons(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Top Navbar */}
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-10 relative">
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:text-teal-400 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">GreenRE Hybrid Reservation System</h1>
            <p className="text-xs text-slate-400">Hotel Stays & Event Space Orchestrator</p>
          </div>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button 
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${view === 'customer' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setView('customer')}
          >
            Booking Portal (Customer)
          </button>
          <button 
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${view === 'admin' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setView('admin')}
          >
            Timeline & Ops (Admin)
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {view === 'customer' ? (
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
            {/* Left: Configuration Wizard */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200">
                {['stay', 'meeting', 'ballroom'].map((type) => (
                  <button 
                    key={type}
                    className={`flex-1 py-4 text-center font-semibold capitalize transition-colors ${spaceType === type ? 'border-b-2 border-teal-600 text-teal-700 bg-teal-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
                    onClick={() => setSpaceType(type)}
                  >
                    {type === 'stay' ? 'Overnight Stay' : type === 'meeting' ? 'Meeting Rooms' : 'Event Ballrooms'}
                  </button>
                ))}
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date & Time</label>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-700">
                      <CalendarDays size={18} className="text-teal-600" /> Oct 15, 2026
                      <span className="mx-2 text-slate-300">|</span>
                      <Clock size={18} className="text-teal-600" /> 09:00 - 17:00
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Capacity</label>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-700">
                      <Users size={18} className="text-teal-600" /> 200 Pax
                    </div>
                  </div>
                </div>

                {spaceType !== 'stay' && (
                  <>
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <LayoutTemplate size={18} className="text-slate-400" /> Seating Layout Picker
                    </h3>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[
                        { id: 'banquet', name: 'Banquet (Round)', cap: 200 },
                        { id: 'theatre', name: 'Theatre Style', cap: 400 },
                        { id: 'classroom', name: 'Classroom', cap: 150 }
                      ].map(l => (
                        <div 
                          key={l.id}
                          onClick={() => setLayout(l.id)}
                          className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${layout === l.id ? 'border-teal-500 bg-teal-50' : 'border-slate-100 bg-slate-50 hover:border-slate-300'}`}
                        >
                          <div className="font-bold text-slate-700">{l.name}</div>
                          <div className="text-xs text-slate-500 mt-1">Max capacity: {l.cap}</div>
                        </div>
                      ))}
                    </div>

                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <PlusCircle size={18} className="text-slate-400" /> A/V & Catering Add-ons
                    </h3>
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 cursor-pointer" onClick={() => toggleAddon('projector')}>
                        <div className="flex items-center gap-3">
                          <Projector className={addons.projector ? "text-teal-600" : "text-slate-400"} />
                          <div>
                            <div className="text-sm font-bold text-slate-700">4K Laser Projector Package</div>
                            <div className="text-xs text-slate-500">Dual screens, switcher, technician</div>
                          </div>
                        </div>
                        {addons.projector ? <CheckCircle2 className="text-teal-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-200" />}
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 cursor-pointer" onClick={() => toggleAddon('mic')}>
                        <div className="flex items-center gap-3">
                          <Mic2 className={addons.mic ? "text-teal-600" : "text-slate-400"} />
                          <div>
                            <div className="text-sm font-bold text-slate-700">Premium Wireless Audio</div>
                            <div className="text-xs text-slate-500">4 roaming mics, line array PA</div>
                          </div>
                        </div>
                        {addons.mic ? <CheckCircle2 className="text-teal-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-200" />}
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 cursor-pointer" onClick={() => toggleAddon('coffee')}>
                        <div className="flex items-center gap-3">
                          <Coffee className={addons.coffee ? "text-teal-600" : "text-slate-400"} />
                          <div>
                            <div className="text-sm font-bold text-slate-700">Full-Day Coffee & Snack Break</div>
                            <div className="text-xs text-slate-500">Morning & Afternoon artisanal pastries</div>
                          </div>
                        </div>
                        {addons.coffee ? <CheckCircle2 className="text-teal-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-200" />}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right: Summary & Checkout */}
            <div className="w-full lg:w-80 bg-slate-900 rounded-xl shadow-lg p-6 text-slate-300 flex flex-col">
              <h2 className="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-4">Booking Summary</h2>
              
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center">
                  <span>Grand Ballroom A</span>
                  <span className="text-white font-medium">$2,500</span>
                </div>
                <div className="text-xs text-slate-500 pb-2 border-b border-slate-800">Base rental (Full Day)</div>

                <div className="flex justify-between items-center">
                  <span>Setup Fee</span>
                  <span className="text-white font-medium">$350</span>
                </div>
                <div className="text-xs text-slate-500 pb-2 border-b border-slate-800">Layout: {layout}</div>

                {addons.projector && <div className="flex justify-between items-center text-sm"><span>4K Projector</span><span className="text-white">$400</span></div>}
                {addons.mic && <div className="flex justify-between items-center text-sm"><span>Audio Package</span><span className="text-white">$150</span></div>}
                {addons.coffee && <div className="flex justify-between items-center text-sm"><span>Coffee Break (200pax)</span><span className="text-white">$1,800</span></div>}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700">
                <div className="flex justify-between items-end mb-6">
                  <span className="text-sm uppercase tracking-wider font-semibold text-slate-400">Total</span>
                  <span className="text-3xl font-bold text-white">
                    ${2500 + 350 + (addons.projector?400:0) + (addons.mic?150:0) + (addons.coffee?1800:0)}
                  </span>
                </div>
                <button className="w-full bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-lg transition-colors shadow-lg shadow-teal-500/20">
                  Hold & Book Now
                </button>
                <p className="text-center text-xs text-slate-500 mt-4 flex items-center justify-center gap-1">
                  <Clock size={12} /> Holds inventory for 15 minutes
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Admin Ops View */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Resource Timeline Visualizer</h2>
                  <p className="text-sm text-slate-500">Live PostgreSQL TSTZRANGE conflict prevention active</p>
                </div>
                <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors">
                  <Download size={16} /> Export PDF Quote
                </button>
              </div>

              {/* Mock Gantt Chart */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Time Header */}
                  <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 h-10">
                    <div className="col-span-2 border-r border-slate-200 p-3 flex items-center bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Spaces</div>
                    {[8,10,12,14,16,18,20,22,24,2].map((h, i) => (
                      <div key={i} className="border-r border-slate-100 p-3 text-center">{h}:00</div>
                    ))}
                  </div>

                  {/* Ballroom Row */}
                  <div className="grid grid-cols-12 border-b border-slate-100 h-20 bg-white relative group">
                    <div className="col-span-2 border-r border-slate-200 p-3 font-semibold text-sm text-slate-800 flex items-center bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50">Grand Ballroom A</div>
                    
                    {/* Booking Block */}
                    <div className="absolute top-2 bottom-2 left-[25%] right-[40%] bg-teal-100 border border-teal-300 rounded-md z-0 flex items-center shadow-sm">
                      <div className="w-16 h-full bg-slate-700/10 border-r border-dashed border-slate-400/50 rounded-l-md flex items-center justify-center text-[10px] font-bold text-slate-500" title="Setup Buffer">SETUP</div>
                      <div className="flex-1 px-3 text-sm font-bold text-teal-800 flex items-center justify-between">
                        Tech Conference 2026
                        <span className="px-2 py-0.5 bg-teal-200 rounded-full text-xs text-teal-900">Confirmed</span>
                      </div>
                      <div className="w-16 h-full bg-slate-700/10 border-l border-dashed border-slate-400/50 rounded-r-md flex items-center justify-center text-[10px] font-bold text-slate-500" title="Teardown Buffer">TEARDOWN</div>
                    </div>
                  </div>

                  {/* Meeting Room Row */}
                  <div className="grid grid-cols-12 border-b border-slate-100 h-20 bg-white relative group">
                    <div className="col-span-2 border-r border-slate-200 p-3 font-semibold text-sm text-slate-800 flex items-center bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50">Meeting Room 1</div>
                    
                    <div className="absolute top-4 bottom-4 left-[20%] right-[65%] bg-indigo-100 border border-indigo-300 rounded-md z-0 flex items-center px-3 shadow-sm">
                      <span className="text-xs font-bold text-indigo-800 truncate">Board Meeting</span>
                    </div>

                    <div className="absolute top-4 bottom-4 left-[40%] right-[30%] bg-amber-100 border border-amber-300 rounded-md z-0 flex items-center px-3 shadow-sm">
                      <span className="text-xs font-bold text-amber-800 truncate">Training Session (Hold)</span>
                    </div>
                  </div>

                  {/* Overlap Error Demo Row */}
                  <div className="grid grid-cols-12 h-20 bg-rose-50/30 relative group">
                    <div className="col-span-2 border-r border-slate-200 p-3 font-semibold text-sm text-slate-800 flex flex-col justify-center bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50">
                      <span>Ballroom B</span>
                      <span className="text-[10px] font-bold text-rose-500">GIST EXCLUSION ERR</span>
                    </div>
                    
                    <div className="absolute top-2 h-7 left-[30%] right-[50%] bg-slate-200 border border-slate-300 rounded-md z-0 flex items-center px-2">
                      <span className="text-xs font-bold text-slate-600">Existing Booking</span>
                    </div>
                    
                    <div className="absolute bottom-2 h-7 left-[45%] right-[25%] bg-rose-200 border-2 border-rose-500 rounded-md z-10 flex items-center px-2 shadow-md animate-pulse">
                      <span className="text-xs font-bold text-rose-900">Attempted Double Booking Blocked!</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">PostgreSQL Anti-Overlap Schema</h3>
                <pre className="bg-slate-900 text-teal-400 p-4 rounded-lg text-xs overflow-x-auto shadow-inner">
{`CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES spaces(id),
  booking_window TSTZRANGE NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmed',
  
  EXCLUDE USING GIST (
    space_id WITH =,
    booking_window WITH &&
  ) WHERE (status != 'cancelled')
);`}
                </pre>
                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  The <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">&&</code> operator in PostgreSQL checks for overlapping ranges. When a new booking attempts to intersect an existing timeframe, the database engine enforces an exclusion violation, making double bookings mathematically impossible regardless of API race conditions.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center items-center text-center">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <FileText size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Automated Quotation Engine</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Generate instant, itemized PDF quotes for corporate inquiries combining room rental, layout setups, F&B per pax, and AV hardware.
                </p>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full text-sm font-bold shadow-md transition-all">
                  Run FastAPI Generator
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
