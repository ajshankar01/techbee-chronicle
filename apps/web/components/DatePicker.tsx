'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (val: string) => void;
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Month names
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Calendar focus month/year
  const [focusMonth, setFocusMonth] = useState(new Date().getMonth());
  const [focusYear, setFocusYear] = useState(new Date().getFullYear());

  // Available years for dropdown
  const startYear = 2010;
  const endYear = 2030;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  // Synchronize internal value -> display string (DD-MM-YYYY)
  useEffect(() => {
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        const [y, m, d] = parts;
        setInputValue(`${d}-${m}-${y}`);
        setFocusMonth(parseInt(m, 10) - 1);
        setFocusYear(parseInt(y, 10));
      }
    } else {
      setInputValue("");
    }
  }, [value]);

  // Click outside detection to close popup
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Parse typed text on the fly
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    // Strip non-digits and non-dashes
    val = val.replace(/[^\d-]/g, "");
    
    // Automatically add dashes while typing (supporting backspace cleanly)
    const isDeleting = (e.nativeEvent as any).inputType === "deleteContentBackward";
    if (!isDeleting) {
      if (val.length === 2 && !val.includes("-")) {
        val = val + "-";
      } else if (val.length === 5 && val.split("-").length === 2) {
        val = val + "-";
      }
    }
    
    // Limit to 10 chars (DD-MM-YYYY)
    if (val.length > 10) {
      val = val.slice(0, 10);
    }
    
    setInputValue(val);

    // If fully matches DD-MM-YYYY, parse it and update parent
    const match = val.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      const d = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const y = parseInt(match[3], 10);

      const parsedDate = new Date(y, m - 1, d);
      if (
        parsedDate.getFullYear() === y &&
        parsedDate.getMonth() === m - 1 &&
        parsedDate.getDate() === d
      ) {
        // Valid date
        const formattedMonth = String(m).padStart(2, "0");
        const formattedDay = String(d).padStart(2, "0");
        onChange(`${y}-${formattedMonth}-${formattedDay}`);
        setFocusMonth(m - 1);
        setFocusYear(y);
      }
    }
  };

  // Day selection from grid
  const handleSelectDay = (day: number) => {
    const formattedMonth = String(focusMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    onChange(`${focusYear}-${formattedMonth}-${formattedDay}`);
    setIsOpen(false);
  };

  // Grid calculation helpers
  const daysInMonth = new Date(focusYear, focusMonth + 1, 0).getDate();
  const startDayOfWeek = new Date(focusYear, focusMonth, 1).getDay();
  const daysGrid: (number | null)[] = [];
  
  // Padding cells
  for (let i = 0; i < startDayOfWeek; i++) {
    daysGrid.push(null);
  }
  // Days of month
  for (let i = 1; i <= daysInMonth; i++) {
    daysGrid.push(i);
  }

  // Selected date extraction for highlight
  let selectedDay = null;
  let selectedMonth = null;
  let selectedYear = null;
  if (value) {
    const [y, m, d] = value.split("-");
    selectedYear = parseInt(y, 10);
    selectedMonth = parseInt(m, 10) - 1;
    selectedDay = parseInt(d, 10);
  }

  const isDateValid = () => {
    if (!inputValue) return false;
    const match = inputValue.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return false;
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const y = parseInt(match[3], 10);
    const parsedDate = new Date(y, m - 1, d);
    return (
      parsedDate.getFullYear() === y &&
      parsedDate.getMonth() === m - 1 &&
      parsedDate.getDate() === d
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: 14 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id="login-doj"
          type="text"
          placeholder="DD-MM-YYYY"
          value={inputValue}
          onChange={handleTextChange}
          onFocus={() => setIsOpen(true)}
          required
          style={{
            width: "100%", 
            padding: "10px 40px 10px 14px", 
            borderRadius: 10,
            background: "#ffffff", 
            border: isDateValid() 
              ? "1px solid #10b981" 
              : inputValue.length === 10 
              ? "1px solid #ef4444" 
              : "1px solid rgba(79, 70, 229, 0.18)",
            color: "var(--text-primary)", 
            fontSize: 13, 
            outline: "none", 
            boxSizing: "border-box",
            transition: "border 0.2s ease",
            fontFamily: "inherit"
          }}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: 'absolute',
            right: 12,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: 'var(--color-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Calendar size={16} />
        </button>
      </div>



      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          zIndex: 1000,
          marginBottom: 6,
          width: '100%',
          minWidth: '280px',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(79, 70, 229, 0.16)',
          borderRadius: 14,
          boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -8px 10px -6px rgba(0, 0, 0, 0.05)',
          padding: 14,
          boxSizing: 'border-box',
          fontFamily: 'inherit'
        }}>
          {/* Header Month / Year drop downs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <select
              value={focusMonth}
              onChange={(e) => setFocusMonth(parseInt(e.target.value, 10))}
              style={{
                flex: 2,
                padding: '6px 8px',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid rgba(79, 70, 229, 0.12)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            
            <select
              value={focusYear}
              onChange={(e) => setFocusYear(parseInt(e.target.value, 10))}
              style={{
                flex: 1.2,
                padding: '6px 8px',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid rgba(79, 70, 229, 0.12)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Weekday headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            marginBottom: 6,
            opacity: 0.8
          }}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2
          }}>
            {daysGrid.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} style={{ height: '30px' }} />;
              }
              const isSelected = selectedDay === day && selectedMonth === focusMonth && selectedYear === focusYear;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  style={{
                    height: '30px',
                    width: '30px',
                    borderRadius: 8,
                    border: 'none',
                    background: isSelected ? 'var(--gradient-brand)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    margin: '0 auto'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(79, 70, 229, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
