import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../layouts/AppShell';
import { Badge, PageHeader, StatusPill, Tabs } from '../ui';
import { 
  ArrowLeft, CalendarDays, Clock, Users, Coffee, Projector, 
  Mic2, LayoutTemplate, PlusCircle, CheckCircle2, 
  FileText, Download, ThermometerSun, Zap, Bed, Moon, 
  ShieldCheck, Check, Sparkles, AlertCircle, Building2,
  ChevronRight, Car, Bath
} from 'lucide-react';

// Room catalog for The Light City Penang (Floors L14 - L28 Hyatt Hotel)
const HOTEL_ROOMS = [
  {
    id: 'deluxe-king',
    name: 'Deluxe King Room (Sea View)',
    floor: 'Floor L14 - L20',
    view: 'Penang Strait Panoramic Sea View',
    pricePerNight: 380,
    size: '42 m²',
    bed: '1 King Bed',
    maxPax: 2,
    badge: 'Popular Choice',
    features: ['Sea View Balcony', 'Smart Eco-HVAC', 'Rain Shower', 'High-Speed Wi-Fi'],
  },
  {
    id: 'executive-suite',
    name: 'Executive Premier Suite',
    floor: 'Floor L21 - L26',
    view: 'High-Floor Coastal & Skyline View',
    pricePerNight: 620,
    size: '68 m²',
    bed: '1 King Bed + Living Lounge',
    maxPax: 3,
    badge: 'Best Eco-Luxury',
    features: ['Executive Lounge Access', 'Bathtub & Ocean View', 'Smart Energy Controls', 'Free Minibar'],
  },
  {
    id: 'family-suite',
    name: 'Grand Family Suite',
    floor: 'Floor L27 - L28',
    view: 'Dual Horizon City & Sea View',
    pricePerNight: 850,
    size: '95 m²',
    bed: '2 King Beds (2 Bedrooms)',
    maxPax: 4,
    badge: 'Spacious Stay',
    features: ['2 Separate Bedrooms', 'Family Dining Nook', 'Kitchenette & Coffee Bar', 'Smart TV in each room'],
  },
  {
    id: 'presidential-suite',
    name: 'Presidential Skyline Penthouse',
    floor: 'Floor L28 Penthouse',
    view: '360° Penang Island & Harbor View',
    pricePerNight: 1800,
    size: '180 m²',
    bed: 'Master Suite + VIP Guest Room',
    maxPax: 4,
    badge: 'Zero-Carbon Flagship',
    features: ['Private Terrace Jacuzzi', '24/7 Dedicated Butler', 'Private Solar EV Bay', 'GreenRE Platinum Certified'],
  },
];

// Sustainable Hotel Add-ons
const HOTEL_ADDONS = [
  {
    id: 'green_housekeeping',
    name: 'GreenRE Eco-Stay (Opt-out Daily Linen Wash)',
    desc: 'Conserves 45L fresh water/day & 3.2 kWh electricity per room',
    price: -20, // Rebate per night!
    isRebate: true,
    icon: '🌱',
    unit: '/ night rebate',
  },
  {
    id: 'breakfast',
    name: 'Artisanal Farm-to-Table Breakfast Buffet',
    desc: 'Local organic Penang ingredients, barista coffee, and fresh cold-pressed juices',
    price: 55,
    icon: '🥐',
    unit: '/ guest / day',
  },
  {
    id: 'ev_charging',
    name: 'EV Valet & 22kW Solar Charging Station',
    desc: 'Dedicated overnight covered charging slot powered by building rooftop solar',
    price: 35,
    icon: '⚡',
    unit: '/ stay',
  },
  {
    id: 'spa_wellness',
    name: 'The Light Hydrotherapy & Sky Pool Pass',
    desc: 'Heated oceanfront infinity pool, Himalayan salt sauna, and herbal steam lounge',
    price: 90,
    icon: '🧖',
    unit: '/ guest',
  },
];

const getTodayStr = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const getFutureDateStr = (days = 2) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function ReservationPage() {
  const [view, setView] = useState('customer'); // 'customer' | 'admin'
  const [spaceType, setSpaceType] = useState('stay'); // 'stay' (Hotel) | 'meeting' | 'ballroom'
  
  // Hotel Stay state
  const [checkInDate, setCheckInDate] = useState(() => getTodayStr());
  const [checkOutDate, setCheckOutDate] = useState(() => getFutureDateStr(2));
  const [selectedRoomId, setSelectedRoomId] = useState('deluxe-king');
  const [adults, setAdults] = useState(2);
  const [roomsCount, setRoomsCount] = useState(1);
  const [hotelAddons, setHotelAddons] = useState({
    green_housekeeping: true,
    breakfast: true,
    ev_charging: false,
    spa_wellness: false,
  });

  // Meeting / Ballroom state
  const [eventDate, setEventDate] = useState(() => getFutureDateStr(3));
  const [eventTimeSlot, setEventTimeSlot] = useState('full-day'); // 'morning' | 'afternoon' | 'full-day'
  const [layout, setLayout] = useState('banquet');
  const [capacity, setCapacity] = useState(200);
  const [eventAddons, setEventAddons] = useState({ coffee: true, projector: false, mic: true });

  // Confirmation modal state
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Weather & Energy state
  const [weather, setWeather] = useState(null);
  const [tariffRates, setTariffRates] = useState([]);

  // Calculate nights
  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    return Math.max(1, isNaN(diff) ? 1 : diff);
  }, [checkInDate, checkOutDate]);

  // Selected room object
  const selectedRoom = useMemo(() => {
    return HOTEL_ROOMS.find(r => r.id === selectedRoomId) || HOTEL_ROOMS[0];
  }, [selectedRoomId]);

  const toggleHotelAddon = (id) => {
    setHotelAddons(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleEventAddon = (key) => {
    setEventAddons(p => ({ ...p, [key]: !p[key] }));
  };

  const formatRM = (value) => `RM ${Number(value || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-MY', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleCheckInChange = (e) => {
    const newIn = e.target.value;
    setCheckInDate(newIn);
    // Ensure check-out is strictly after check-in
    if (newIn >= checkOutDate) {
      const d = new Date(newIn);
      d.setDate(d.getDate() + 1);
      setCheckOutDate(d.toISOString().split('T')[0]);
    }
  };

  const handleCheckOutChange = (e) => {
    const newOut = e.target.value;
    if (newOut > checkInDate) {
      setCheckOutDate(newOut);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/weather').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/v1/tariff/rates').then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([weatherData, rates]) => {
      if (weatherData?.status === 'success') setWeather(weatherData);
      if (Array.isArray(rates)) setTariffRates(rates);
    });
  }, []);

  // Energy and cost estimation
  const energyEstimate = useMemo(() => {
    const outdoorTemp = weather?.temperature ?? 30.5;
    const humidity = weather?.humidity ?? 78;

    const weekdayRates = tariffRates.filter((rate) =>
      String(rate.name || '').toLowerCase().includes('weekday')
    );
    const peakRate = weekdayRates.find((rate) =>
      String(rate.name || '').toLowerCase().includes('peak')
    )?.rate_per_kwh;
    const rate = Number(peakRate || weekdayRates[0]?.rate_per_kwh || 0.337);

    if (spaceType === 'stay') {
      // Hotel room energy calculation
      const roomBaseKw = selectedRoom.id === 'presidential-suite' ? 3.8
        : selectedRoom.id === 'family-suite' ? 2.5
        : selectedRoom.id === 'executive-suite' ? 1.8
        : 1.2;
      
      const ecoDiscount = hotelAddons.green_housekeeping ? 0.88 : 1.0;
      const weatherFactor = outdoorTemp >= 32 ? 1.15 : outdoorTemp >= 29 ? 1.08 : 0.95;
      const estimatedKw = roomBaseKw * weatherFactor * ecoDiscount * roomsCount;
      const hoursPerStay = nights * 14; // Average 14 hours HVAC run per room/night
      const estimatedKwh = estimatedKw * hoursPerStay;
      const estimatedCost = estimatedKwh * rate;
      const suggestedSetpoint = outdoorTemp >= 31 ? 24.0 : 23.5;
      const co2eAvoided = hotelAddons.green_housekeeping ? (3.2 * nights * 0.65).toFixed(1) : '0.0';

      return {
        outdoorTemp,
        humidity,
        estimatedKw,
        estimatedKwh,
        estimatedCost,
        suggestedSetpoint,
        rate,
        co2eAvoided,
      };
    } else {
      // Event / Meeting energy calculation
      const hours = eventTimeSlot === 'full-day' ? 8 : 4;
      const baseKw = spaceType === 'meeting' ? 18 : 45;
      const occupancyFactor = 1 + Math.min(1.5, capacity / 200);
      const hvacWeatherFactor = outdoorTemp >= 31 ? 1.12 : outdoorTemp >= 28 ? 1.06 : 0.92;
      const estimatedKw = baseKw * occupancyFactor * hvacWeatherFactor;
      const estimatedKwh = estimatedKw * hours
        + (eventAddons.projector ? 1.4 * hours : 0)
        + (eventAddons.mic ? 0.25 * hours : 0)
        + (eventAddons.coffee ? 2.2 * hours : 0);
      const estimatedCost = estimatedKwh * rate;
      const suggestedSetpoint = outdoorTemp >= 30 ? 24 : 23.5;

      return {
        outdoorTemp,
        humidity,
        estimatedKw,
        estimatedKwh,
        estimatedCost,
        suggestedSetpoint,
        rate,
        co2eAvoided: '12.4',
      };
    }
  }, [weather, tariffRates, spaceType, selectedRoom, nights, roomsCount, hotelAddons, capacity, eventTimeSlot, eventAddons]);

  // Hotel Stay Total Calculation
  const hotelBaseTotal = selectedRoom.pricePerNight * nights * roomsCount;
  const hotelAddonsTotal = useMemo(() => {
    let sum = 0;
    if (hotelAddons.green_housekeeping) sum += (-20 * nights * roomsCount); // Rebate
    if (hotelAddons.breakfast) sum += (55 * adults * nights);
    if (hotelAddons.ev_charging) sum += (35 * roomsCount);
    if (hotelAddons.spa_wellness) sum += (90 * adults);
    return sum;
  }, [hotelAddons, nights, roomsCount, adults]);

  const hotelGrandTotal = Math.max(0, hotelBaseTotal + hotelAddonsTotal);

  // Event / Meeting Total Calculation
  const eventBasePrice = spaceType === 'ballroom' ? 2500 : 950;
  const eventSetupFee = spaceType === 'ballroom' ? 350 : 150;
  const eventGrandTotal = eventBasePrice + eventSetupFee
    + (eventAddons.projector ? 400 : 0)
    + (eventAddons.mic ? 150 : 0)
    + (eventAddons.coffee ? 1800 : 0);

  const activeTotal = spaceType === 'stay' ? hotelGrandTotal : eventGrandTotal;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Reserve management"
        accent="var(--gg-reserve)"
        title="Hybrid reservation system"
        description="Book hotel stays, meeting rooms and ballrooms. Every booking feeds the HVAC and lighting schedule for its floor."
        meta={<><StatusPill tone="success" pulse>System active</StatusPill><Badge tone="info">GreenRE score 88.4 · Platinum</Badge></>}
        actions={
          <Tabs
            label="Reservation view"
            value={view}
            onChange={setView}
            items={[
              { value: 'customer', label: 'Booking portal' },
              { value: 'admin', label: 'Timeline & ops' },
            ]}
          />
        }
      />

      {/* Main Reservation Content */}
      <div>
        <div>
          {view === 'customer' ? (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              
              {/* LEFT COLUMN: Main Booking Wizard */}
              <div 
                className="flex-1 w-full rounded-2xl overflow-hidden shadow-2xl border"
                style={{ 
                  background: '#ffffff', 
                  borderColor: '#cbd5e1',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)'
                }}
              >
                {/* Space Type Selector Tabs */}
                <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {[
                    { id: 'stay', label: '🏨 Hotel Room Stay', sub: 'Floors L14 - L28 Hyatt' },
                    { id: 'meeting', label: '💼 Meeting Rooms', sub: 'Floor L4 Innovation Pods' },
                    { id: 'ballroom', label: '🎪 Event Ballrooms', sub: 'Floor L3 Grand Hall' },
                  ].map((tab) => {
                    const isActive = spaceType === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSpaceType(tab.id)}
                        style={{
                          flex: 1,
                          padding: '16px 12px',
                          border: 'none',
                          borderBottom: isActive ? '3px solid #0d9488' : '3px solid transparent',
                          background: isActive ? '#ffffff' : 'transparent',
                          color: isActive ? '#0f766e' : '#475569',
                          fontWeight: isActive ? 800 : 600,
                          fontSize: '15px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>{tab.label}</div>
                        <div style={{ fontSize: '11px', color: isActive ? '#0d9488' : '#94a3b8', fontWeight: 500, marginTop: '2px' }}>{tab.sub}</div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ padding: '24px' }}>
                  
                  {/* ============================================================== */}
                  {/* 1. HOTEL ROOM STAY MODE                                        */}
                  {/* ============================================================== */}
                  {spaceType === 'stay' ? (
                    <div>
                      {/* Section Title */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Bed size={22} color="#0f766e" />
                          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            Select Dates & Hotel Room
                          </h2>
                        </div>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 700, 
                          color: '#047857', 
                          background: '#d1fae5', 
                          padding: '4px 10px', 
                          borderRadius: '20px',
                          border: '1px solid #6ee7b7'
                        }}>
                          ⚡ Low-Carbon Stay Guarantee
                        </span>
                      </div>

                      {/* Check-In / Check-Out & Guests Bar */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                        gap: '14px', 
                        background: '#f1f5f9', 
                        padding: '16px', 
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        marginBottom: '20px'
                      }}>
                        {/* Check-in Date Picker */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            📅 Check-In Date
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input 
                              type="date"
                              value={checkInDate}
                              min={getTodayStr()}
                              onChange={handleCheckInChange}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: '#ffffff',
                                border: '2px solid #94a3b8',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 700,
                                color: '#0f172a',
                                outline: 'none',
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#047857', marginTop: '4px' }}>
                            {formatDateDisplay(checkInDate)}
                          </div>
                        </div>

                        {/* Check-out Date Picker */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            📅 Check-Out Date
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input 
                              type="date"
                              value={checkOutDate}
                              min={checkInDate}
                              onChange={handleCheckOutChange}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: '#ffffff',
                                border: '2px solid #94a3b8',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 700,
                                color: '#0f172a',
                                outline: 'none',
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#047857', marginTop: '4px' }}>
                            {formatDateDisplay(checkOutDate)}
                          </div>
                        </div>

                        {/* Duration Badge & Guests */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                              🌙 Duration
                            </label>
                            <div style={{
                              background: '#e0f2fe',
                              border: '2px solid #7dd3fc',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              fontWeight: 800,
                              fontSize: '15px',
                              color: '#0369a1',
                              textAlign: 'center',
                            }}>
                              {nights} {nights === 1 ? 'Night' : 'Nights'}
                            </div>
                          </div>

                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                              👥 Guests
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '2px solid #94a3b8', borderRadius: '8px', padding: '7px 8px' }}>
                              <Users size={16} color="#0f766e" style={{ marginRight: '6px' }} />
                              <select 
                                value={adults}
                                onChange={(e) => setAdults(Number(e.target.value))}
                                style={{
                                  width: '100%',
                                  background: 'transparent',
                                  border: 'none',
                                  fontSize: '14px',
                                  fontWeight: 700,
                                  color: '#0f172a',
                                  outline: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                {[1, 2, 3, 4, 5, 6].map(num => (
                                  <option key={num} value={num}>{num} {num === 1 ? 'Guest' : 'Guests'}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Live Penang Weather & HVAC Comfort Cards (High Contrast) */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                        gap: '12px', 
                        marginBottom: '24px' 
                      }}>
                        {/* Penang Weather */}
                        <div style={{ 
                          background: '#f0f9ff', 
                          border: '2px solid #bae6fd', 
                          borderRadius: '10px', 
                          padding: '12px 14px' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>
                            <ThermometerSun size={17} /> Live Penang Weather
                          </div>
                          <div style={{ marginTop: '8px', fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
                            {energyEstimate.outdoorTemp}°C
                            <span style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7', marginLeft: '10px' }}>
                              {energyEstimate.humidity}% RH
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#334155', fontWeight: 600, marginTop: '4px' }}>
                            Live sensor feed · Bayan Lepas
                          </div>
                        </div>

                        {/* Suggested Eco Air-Con */}
                        <div style={{ 
                          background: '#f0fdfa', 
                          border: '2px solid #99f6e4', 
                          borderRadius: '10px', 
                          padding: '12px 14px' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase' }}>
                            <Sparkles size={17} /> Suggested Air-Con
                          </div>
                          <div style={{ marginTop: '8px', fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
                            {energyEstimate.suggestedSetpoint}°C
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d9488', marginLeft: '8px' }}>
                              Eco-Setpoint
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#334155', fontWeight: 600, marginTop: '4px' }}>
                            GreenRE Non-Res v3.0 compliant
                          </div>
                        </div>

                        {/* Estimated Energy Usage */}
                        <div style={{ 
                          background: '#fffbeb', 
                          border: '2px solid #fde68a', 
                          borderRadius: '10px', 
                          padding: '12px 14px' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                            <Zap size={17} /> Estimated Energy
                          </div>
                          <div style={{ marginTop: '8px', fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
                            {energyEstimate.estimatedKwh.toFixed(0)} kWh
                          </div>
                          <div style={{ fontSize: '12px', color: '#78350f', fontWeight: 700, marginTop: '4px' }}>
                            Approx. {formatRM(energyEstimate.estimatedCost)} electricity
                          </div>
                        </div>
                      </div>

                      {/* Room Selection Grid */}
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            Choose Room Category
                          </h3>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                            All rooms include Smart Energy Thermostats
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                          {HOTEL_ROOMS.map((room) => {
                            const isSelected = selectedRoomId === room.id;
                            return (
                              <div
                                key={room.id}
                                onClick={() => setSelectedRoomId(room.id)}
                                style={{
                                  border: isSelected ? '2px solid #0d9488' : '2px solid #e2e8f0',
                                  background: isSelected ? '#f0fdfa' : '#ffffff',
                                  borderRadius: '12px',
                                  padding: '16px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: isSelected ? '0 4px 12px rgba(13, 148, 136, 0.2)' : 'none',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <span style={{
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      color: isSelected ? '#0f766e' : '#475569',
                                      background: isSelected ? '#ccfbf1' : '#f1f5f9',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                    }}>
                                      {room.floor}
                                    </span>
                                    <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '8px 0 2px 0' }}>
                                      {room.name}
                                    </h4>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                                      {room.view}
                                    </div>
                                  </div>
                                  
                                  {isSelected ? (
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <Check size={14} color="#ffffff" strokeWidth={3} />
                                    </div>
                                  ) : (
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid #cbd5e1' }} />
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', fontSize: '12px', color: '#334155', fontWeight: 600 }}>
                                  <span>📐 {room.size}</span>
                                  <span>🛏️ {room.bed}</span>
                                  <span>👥 Up to {room.maxPax}</span>
                                </div>

                                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                  <div>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Nightly Rate</span>
                                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f766e' }}>
                                      {formatRM(room.pricePerNight)}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                    {formatRM(room.pricePerNight * nights)} <span style={{ fontSize: '11px', color: '#64748b' }}>({nights}N)</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hotel Stay Add-ons (Eco rebates & amenities) */}
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sparkles size={18} color="#0f766e" /> Sustainable Stay & Comfort Add-ons
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {HOTEL_ADDONS.map((addon) => {
                            const isChecked = !!hotelAddons[addon.id];
                            return (
                              <div
                                key={addon.id}
                                onClick={() => toggleHotelAddon(addon.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '14px 16px',
                                  borderRadius: '10px',
                                  border: isChecked 
                                    ? (addon.isRebate ? '2px solid #059669' : '2px solid #0d9488') 
                                    : '2px solid #e2e8f0',
                                  background: isChecked 
                                    ? (addon.isRebate ? '#ecfdf5' : '#f0fdfa') 
                                    : '#ffffff',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontSize: '24px' }}>{addon.icon}</span>
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                                      {addon.name}
                                    </div>
                                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#475569', marginTop: '2px' }}>
                                      {addon.desc}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ 
                                      fontSize: '15px', 
                                      fontWeight: 900, 
                                      color: addon.isRebate ? '#059669' : '#0f766e' 
                                    }}>
                                      {addon.isRebate ? `-RM ${Math.abs(addon.price)}` : formatRM(addon.price)}
                                    </span>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{addon.unit}</div>
                                  </div>
                                  
                                  {isChecked ? (
                                    <div style={{ 
                                      width: '24px', 
                                      height: '24px', 
                                      borderRadius: '6px', 
                                      background: addon.isRebate ? '#059669' : '#0d9488', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center' 
                                    }}>
                                      <Check size={16} color="#ffffff" strokeWidth={3} />
                                    </div>
                                  ) : (
                                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', border: '2px solid #94a3b8' }} />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ============================================================== */
                    /* 2. MEETING ROOM / EVENT BALLROOM MODE                          */
                    /* ============================================================== */
                    <div>
                      {/* Section Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Building2 size={22} color="#0f766e" />
                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {spaceType === 'meeting' ? 'Configure Meeting Room' : 'Configure Event Ballroom'}
                        </h2>
                      </div>

                      {/* Date & Time Slot Picker */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                        gap: '14px', 
                        background: '#f1f5f9', 
                        padding: '16px', 
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        marginBottom: '20px'
                      }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            📅 Booking Date
                          </label>
                          <input 
                            type="date"
                            value={eventDate}
                            min={getTodayStr()}
                            onChange={(e) => setEventDate(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              background: '#ffffff',
                              border: '2px solid #94a3b8',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#0f172a',
                              outline: 'none',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            ⏰ Time Slot
                          </label>
                          <select
                            value={eventTimeSlot}
                            onChange={(e) => setEventTimeSlot(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              background: '#ffffff',
                              border: '2px solid #94a3b8',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#0f172a',
                              outline: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="full-day">Full Day (09:00 - 17:00 · 8 Hours)</option>
                            <option value="morning">Morning Half-Day (08:30 - 12:30 · 4 Hours)</option>
                            <option value="afternoon">Afternoon Half-Day (13:30 - 17:30 · 4 Hours)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            👥 Expected Capacity
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '2px solid #94a3b8', borderRadius: '8px', padding: '6px 12px' }}>
                            <Users size={18} color="#0f766e" style={{ marginRight: '8px' }} />
                            <input
                              type="number"
                              min="10"
                              max="400"
                              value={capacity}
                              onChange={(e) => setCapacity(Math.max(10, Number(e.target.value) || 10))}
                              style={{
                                width: '80px',
                                background: 'transparent',
                                border: 'none',
                                fontSize: '15px',
                                fontWeight: 800,
                                color: '#0f172a',
                                outline: 'none',
                              }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Pax</span>
                          </div>
                        </div>
                      </div>

                      {/* Seating Layout Picker */}
                      <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <LayoutTemplate size={18} color="#0f766e" /> Seating Layout Picker
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                          {[
                            { id: 'banquet', name: 'Banquet (Round Tables)', cap: 200, desc: 'Ideal for galas, weddings & dining' },
                            { id: 'theatre', name: 'Theatre Style', cap: 400, desc: 'Maximum capacity for keynotes' },
                            { id: 'classroom', name: 'Classroom Setup', cap: 150, desc: 'Desks with power outlets & Wi-Fi' }
                          ].map(l => (
                            <div 
                              key={l.id}
                              onClick={() => {
                                setLayout(l.id);
                                setCapacity(l.cap);
                              }}
                              style={{
                                cursor: 'pointer',
                                padding: '16px',
                                borderRadius: '10px',
                                border: layout === l.id ? '2px solid #0d9488' : '2px solid #e2e8f0',
                                background: layout === l.id ? '#f0fdfa' : '#ffffff',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>{l.name}</div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f766e', marginTop: '4px' }}>
                                Max capacity: {l.cap} Pax
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{l.desc}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Event Add-ons */}
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PlusCircle size={18} color="#0f766e" /> A/V & Catering Add-ons
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div 
                            onClick={() => toggleEventAddon('projector')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              borderRadius: '10px',
                              border: eventAddons.projector ? '2px solid #0d9488' : '2px solid #e2e8f0',
                              background: eventAddons.projector ? '#f0fdfa' : '#ffffff',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Projector size={24} color={eventAddons.projector ? '#0f766e' : '#64748b'} />
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>4K Laser Projector & Dual Screens</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>Includes HDMI/Wireless switchers & on-site AV technician</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f766e' }}>RM 400.00</span>
                              {eventAddons.projector ? <CheckCircle2 size={20} color="#0d9488" /> : <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #94a3b8' }} />}
                            </div>
                          </div>

                          <div 
                            onClick={() => toggleEventAddon('mic')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              borderRadius: '10px',
                              border: eventAddons.mic ? '2px solid #0d9488' : '2px solid #e2e8f0',
                              background: eventAddons.mic ? '#f0fdfa' : '#ffffff',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Mic2 size={24} color={eventAddons.mic ? '#0f766e' : '#64748b'} />
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Premium Wireless Microphone & Line Array PA</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>4 UHF wireless handheld mics with feedback eliminator</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f766e' }}>RM 150.00</span>
                              {eventAddons.mic ? <CheckCircle2 size={20} color="#0d9488" /> : <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #94a3b8' }} />}
                            </div>
                          </div>

                          <div 
                            onClick={() => toggleEventAddon('coffee')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              borderRadius: '10px',
                              border: eventAddons.coffee ? '2px solid #0d9488' : '2px solid #e2e8f0',
                              background: eventAddons.coffee ? '#f0fdfa' : '#ffffff',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Coffee size={24} color={eventAddons.coffee ? '#0f766e' : '#64748b'} />
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Full-Day Coffee & Artisanal Snack Breaks</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>Morning & Afternoon organic pastries, local fruit & barista coffee</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f766e' }}>RM 1,800.00</span>
                              {eventAddons.coffee ? <CheckCircle2 size={20} color="#0d9488" /> : <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #94a3b8' }} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Booking Summary & Checkout */}
              <div 
                className="w-full lg:w-96 rounded-2xl p-6 border shadow-2xl flex flex-col justify-between"
                style={{ 
                  background: '#0f172a', 
                  borderColor: '#334155',
                  color: '#ffffff',
                  minHeight: '620px'
                }}
              >
                <div>
                  {/* Summary Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '18px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Booking Summary
                    </h3>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '3px 8px', borderRadius: '6px' }}>
                      {spaceType === 'stay' ? 'Hotel Stay' : spaceType === 'meeting' ? 'Meeting Space' : 'Grand Ballroom'}
                    </span>
                  </div>

                  {/* Stay / Event Specifics Breakdown */}
                  {spaceType === 'stay' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Dates overview badge */}
                      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Selected Schedule</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Check-in</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>{checkInDate}</div>
                          </div>
                          <div style={{ color: '#0d9488', fontWeight: 800, fontSize: '14px' }}>➔</div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Check-out</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>{checkOutDate}</div>
                          </div>
                        </div>
                        <div style={{ borderTop: '1px solid #334155', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#38bdf8', fontWeight: 700 }}>🌙 {nights} Nights Stay</span>
                          <span style={{ color: '#cbd5e1' }}>👥 {adults} Guests · {roomsCount} Room</span>
                        </div>
                      </div>

                      {/* Room Item */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ fontWeight: 700, color: '#ffffff' }}>{selectedRoom.name}</span>
                          <span style={{ fontWeight: 800, color: '#ffffff' }}>{formatRM(selectedRoom.pricePerNight * nights)}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                          {formatRM(selectedRoom.pricePerNight)} × {nights} Nights
                        </div>
                      </div>

                      {/* Add-ons List */}
                      {hotelAddons.green_housekeeping && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>🌿 GreenRE Eco-Stay Rebate</span>
                          <span style={{ color: '#34d399', fontWeight: 800 }}>-RM {(20 * nights).toFixed(2)}</span>
                        </div>
                      )}

                      {hotelAddons.breakfast && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#cbd5e1' }}>🥐 Organic Breakfast ({adults}pax × {nights}d)</span>
                          <span style={{ color: '#ffffff', fontWeight: 700 }}>{formatRM(55 * adults * nights)}</span>
                        </div>
                      )}

                      {hotelAddons.ev_charging && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#cbd5e1' }}>⚡ 22kW Solar EV Charging</span>
                          <span style={{ color: '#ffffff', fontWeight: 700 }}>{formatRM(35)}</span>
                        </div>
                      )}

                      {hotelAddons.spa_wellness && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#cbd5e1' }}>🧖 Sky Pool & Spa Pass ({adults}pax)</span>
                          <span style={{ color: '#ffffff', fontWeight: 700 }}>{formatRM(90 * adults)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Event Date & Window</div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                          {eventDate} · {eventTimeSlot === 'full-day' ? '09:00 - 17:00' : 'Half Day'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '2px', fontWeight: 600 }}>
                          Layout: {layout} ({capacity} Pax)
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: '#ffffff', fontWeight: 700 }}>{spaceType === 'ballroom' ? 'Grand Ballroom A' : 'Meeting Room 1'}</span>
                        <span style={{ color: '#ffffff', fontWeight: 800 }}>{formatRM(eventBasePrice)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#cbd5e1' }}>Setup & Technical Labor</span>
                        <span style={{ color: '#ffffff', fontWeight: 700 }}>{formatRM(eventSetupFee)}</span>
                      </div>

                      {eventAddons.projector && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#cbd5e1' }}>4K Projector Package</span>
                          <span style={{ color: '#ffffff', fontWeight: 700 }}>{formatRM(400)}</span>
                        </div>
                      )}

                      {eventAddons.mic && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#cbd5e1' }}>Wireless Audio Package</span>
                          <span style={{ color: '#ffffff', fontWeight: 700 }}>{formatRM(150)}</span>
                        </div>
                      )}

                      {eventAddons.coffee && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#cbd5e1' }}>Full-Day Catering Breaks</span>
                          <span style={{ color: '#ffffff', fontWeight: 700 }}>{formatRM(1800)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Weather-smart energy estimate box */}
                  <div style={{ 
                    marginTop: '20px', 
                    borderRadius: '10px', 
                    border: '1px solid #0369a1', 
                    background: 'rgba(8, 47, 73, 0.5)', 
                    padding: '14px' 
                  }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={14} color="#38bdf8" /> Weather-Smart Energy Predictor
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '10px' }}>
                      <span style={{ color: '#cbd5e1' }}>Air-con setpoint</span>
                      <span style={{ color: '#38bdf8', fontWeight: 800 }}>{energyEstimate.suggestedSetpoint}°C</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '4px' }}>
                      <span style={{ color: '#cbd5e1' }}>Estimated consumption</span>
                      <span style={{ color: '#ffffff', fontWeight: 800 }}>{energyEstimate.estimatedKwh.toFixed(0)} kWh</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '4px' }}>
                      <span style={{ color: '#cbd5e1' }}>Estimated electricity</span>
                      <span style={{ color: '#ffffff', fontWeight: 800 }}>{formatRM(energyEstimate.estimatedCost)}</span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', borderTop: '1px solid #1e3a5f', paddingTop: '6px' }}>
                      TNB Commercial tariff rate: RM {energyEstimate.rate.toFixed(3)}/kWh.
                    </div>
                  </div>
                </div>

                {/* Total and Confirmation CTA */}
                <div style={{ marginTop: '24px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#94a3b8' }}>
                        Total Net Price
                      </span>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Includes 6% SST & Service</div>
                    </div>
                    <span style={{ fontSize: '32px', fontWeight: 900, color: '#34d399' }}>
                      {formatRM(activeTotal)}
                    </span>
                  </div>

                  <button 
                    type="button"
                    onClick={() => setBookingConfirmed(true)}
                    style={{
                      width: '100%',
                      background: '#0d9488',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '16px',
                      padding: '14px',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 4px 14px rgba(13, 148, 136, 0.4)',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#0f766e'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#0d9488'}
                  >
                    {spaceType === 'stay' ? 'Confirm Hotel Reservation' : 'Hold & Book Space Now'}
                  </button>

                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} color="#10b981" /> Free cancellation up to 48 hours before check-in
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* ADMIN TIMELINE VIEW                                            */
            /* ============================================================== */
            <div className="space-y-6">
              <div 
                className="rounded-2xl p-6 border shadow-xl" 
                style={{ background: '#ffffff', borderColor: '#cbd5e1' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Resource Timeline & Booking Visualizer</h2>
                    <p style={{ fontSize: '14px', color: '#475569', margin: '4px 0 0 0' }}>PostgreSQL TSTZRANGE conflict prevention with GiST indexing</p>
                  </div>
                  <button style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f172a', color: '#ffffff', padding: '10px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer' }}>
                    <Download size={16} /> Export Folio & Quote
                  </button>
                </div>

                {/* Timeline Gantt */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', overflowX: 'auto', background: '#ffffff' }}>
                  <div style={{ minWidth: '850px' }}>
                    {/* Header Hours */}
                    <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 h-11">
                      <div className="col-span-2 border-r border-slate-200 p-3 flex items-center bg-slate-200 sticky left-0 z-10">Resource / Space</div>
                      {[8,10,12,14,16,18,20,22,24,2].map((h, i) => (
                        <div key={i} className="border-r border-slate-200 p-3 text-center">{h}:00</div>
                      ))}
                    </div>

                    {/* Hotel Suite L28 Row */}
                    <div className="grid grid-cols-12 border-b border-slate-200 h-20 relative">
                      <div className="col-span-2 border-r border-slate-200 p-3 font-bold text-sm text-slate-900 flex items-center bg-slate-50 sticky left-0 z-10">
                        Hyatt Suite L28
                      </div>
                      <div className="absolute top-3 bottom-3 left-[18%] right-[30%] bg-emerald-100 border border-emerald-400 rounded-lg flex items-center px-4 shadow-sm">
                        <span className="text-xs font-extrabold text-emerald-900">
                          🏨 Active Stay: Dr. Peixuan (Deluxe Suite · Eco-HVAC 23.5°C)
                        </span>
                      </div>
                    </div>

                    {/* Grand Ballroom Row */}
                    <div className="grid grid-cols-12 border-b border-slate-200 h-20 relative">
                      <div className="col-span-2 border-r border-slate-200 p-3 font-bold text-sm text-slate-900 flex items-center bg-slate-50 sticky left-0 z-10">
                        Grand Ballroom A
                      </div>
                      <div className="absolute top-2 bottom-2 left-[25%] right-[40%] bg-teal-100 border border-teal-300 rounded-md flex items-center shadow-sm">
                        <div className="w-16 h-full bg-slate-700/10 border-r border-dashed border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-600">SETUP</div>
                        <div className="flex-1 px-3 text-sm font-bold text-teal-900 flex items-center justify-between">
                          Tech Conference 2026
                          <span className="px-2 py-0.5 bg-teal-200 rounded-full text-xs text-teal-900">Confirmed</span>
                        </div>
                        <div className="w-16 h-full bg-slate-700/10 border-l border-dashed border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-600">TEARDN</div>
                      </div>
                    </div>

                    {/* Meeting Room Row */}
                    <div className="grid grid-cols-12 border-b border-slate-200 h-20 relative">
                      <div className="col-span-2 border-r border-slate-200 p-3 font-bold text-sm text-slate-900 flex items-center bg-slate-50 sticky left-0 z-10">
                        Meeting Room 1
                      </div>
                      <div className="absolute top-4 bottom-4 left-[20%] right-[65%] bg-indigo-100 border border-indigo-300 rounded-md flex items-center px-3 shadow-sm">
                        <span className="text-xs font-bold text-indigo-900 truncate">ESG Board Meeting</span>
                      </div>
                      <div className="absolute top-4 bottom-4 left-[40%] right-[30%] bg-amber-100 border border-amber-300 rounded-md flex items-center px-3 shadow-sm">
                        <span className="text-xs font-bold text-amber-900 truncate">Training Session (Hold)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Booking Confirmation Success Modal */}
      {bookingConfirmed && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#d1fae5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}>
              <Check size={36} strokeWidth={3} />
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0' }}>
              Reservation Confirmed!
            </h3>
            <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Your reservation has been locked in the database. A confirmation email with digital check-in key has been generated.
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '24px',
              fontSize: '13px',
              lineHeight: 1.6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Booking Ref:</span>
                <span style={{ color: '#0f172a', fontWeight: 800 }}>TLC-HOTEL-2026-8812</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Type:</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>
                  {spaceType === 'stay' ? selectedRoom.name : 'Event Space'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Dates:</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>
                  {spaceType === 'stay' ? `${checkInDate} to ${checkOutDate} (${nights}N)` : eventDate}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Total Paid / Billed:</span>
                <span style={{ color: '#059669', fontWeight: 900, fontSize: '15px' }}>{formatRM(activeTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBookingConfirmed(false)}
              style={{
                width: '100%',
                background: '#0d9488',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '15px',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Done & Return to Portal
            </button>
          </div>
        </div>
      )}

    </AppShell>
  );
}
