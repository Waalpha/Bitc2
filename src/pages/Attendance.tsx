import { Link } from 'react-router-dom';
import React, { useEffect, useState, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, addDoc, doc, updateDoc, getDocs, orderBy, limit, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Class, AttendanceRecord, User, SchoolCalendar } from '../types';
import { Calendar, Check, X, Save, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, AlertCircle, BarChart2, List, User as UserIcon, Lock, Unlock, Info, Fingerprint, RefreshCw, Smartphone, QrCode, Camera, History as HistoryIcon, Cpu, Wifi, MapPin, Printer } from 'lucide-react';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend } from 'date-fns';
import { Toast, ToastMessage } from '../components/Toast';
import { motion, AnimatePresence } from 'motion/react';
import { isBiometricSupported, registerBiometric, verifyBiometric } from '../services/biometricService';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeCanvas } from 'qrcode.react';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export const Attendance: React.FC = () => {
  const { user, userData, settings: globalSettings } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<User[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendance, setAttendance] = useState<{ [studentId: string]: AttendanceStatus }>({});
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [schoolCalendar, setSchoolCalendar] = useState<SchoolCalendar[]>([]);
  const [viewMode, setViewMode] = useState<'daily' | 'summary' | 'history' | 'report'>('daily');
  const [reportMonth, setReportMonth] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [isVerifyingBiometric, setIsVerifyingBiometric] = useState(false);
  const [isLinkingDevice, setIsLinkingDevice] = useState(false);
  const [isScannerMode, setIsScannerMode] = useState(false);
  const [isQRScannerMode, setIsQRScannerMode] = useState(false);
  const [usbDevice, setUsbDevice] = useState<any | null>(null);
  const [isLinkingUsb, setIsLinkingUsb] = useState(false);
  const [externalIdInput, setExternalIdInput] = useState('');
  const [currentAction, setCurrentAction] = useState<'checkIn' | 'checkOut' | 'leaveOut'>('checkIn');
  const [leaveReason, setLeaveReason] = useState('General Leave');
  const [returnDate, setReturnDate] = useState('');
  const [lastEvent, setLastEvent] = useState<{
    student: User;
    action: string;
    time: string;
    reason?: string;
    returnDate?: string;
  } | null>(null);
  const [scannerError, setScannerError] = useState(false);
  const [selectedStudentForBio, setSelectedStudentForBio] = useState<string | null>(null);
  const [showNodeMcuPortal, setShowNodeMcuPortal] = useState(false);
  const [nodeMcuTab, setNodeMcuTab] = useState<'overview' | 'arduino' | 'wiring' | 'api'>('overview');
  const [refusedCheckoutStudent, setRefusedCheckoutStudent] = useState<User | null>(null);
  const [refusalReason, setRefusalReason] = useState<string>('');

  const arduinoCodeString = useMemo(() => {
    const origin = window.location.origin;
    return `#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SPI.h>
#include <MFRC522.h>

// PIN Configurations for RFID RC522 to NodeMCU
#define RST_PIN  D3  // Reset pin
#define SS_PIN   D4  // Chip select / SDA pin

MFRC522 mfrc522(SS_PIN, RST_PIN);

// Wi-Fi Config
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server Endpoint (Dynamically populated from current host)
const char* serverUrl = "${origin}/api/nodemcu/attendance?format=text";

// Indicator Pins (LED, Buzzer)
const int GREEN_LED = D1;
const int RED_LED = D2;
const int BUZZER = D8;

void setup() {
  Serial.begin(115200);
  SPI.begin();
  mfrc522.PCD_Init();
  
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  
  // Power-on signal
  digitalWrite(GREEN_LED, HIGH);
  delay(200);
  digitalWrite(GREEN_LED, LOW);
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nConnected to WiFi!");
  
  // Quick beep to confirm setup complete
  tone(BUZZER, 2000, 100);
}

void loop() {
  // Look for new cards
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }
  
  // Extract Card UID
  String cardUID = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    cardUID += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    cardUID += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUID.toUpperCase();
  Serial.println("Card Scanned: " + cardUID);
  
  // Sound buzzer on scan
  tone(BUZZER, 1500, 80);
  
  // Send attendance check
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // Allow HTTPs connect without loading root certificates
    
    HTTPClient http;
    // URL format: serverUrl + "&uid=" + cardUID + "&action=checkIn"
    String finalUrl = String(serverUrl) + "&uid=" + cardUID + "&action=checkIn";
    
    http.begin(client, finalUrl);
    http.addHeader("Content-Type", "application/json");
    
    // Send empty POST body (as endpoint handles check-in)
    int httpResponseCode = http.POST("{}");
    
    if (httpResponseCode > 0) {
      String payload = http.getString();
      Serial.println("HTTP Response code: " + String(httpResponseCode));
      Serial.println("Payload: " + payload);
      
      if (payload.indexOf("SEC_GRANTED") >= 0) {
        // Attendance recorded successfully! Unpaid fees clear!
        digitalWrite(GREEN_LED, HIGH);
        tone(BUZZER, 2500, 300);
        delay(1000);
        digitalWrite(GREEN_LED, LOW);
      } else if (payload.indexOf("SEC_DENIED") >= 0) {
        // Access Denied (e.g., Unpaid fees or student not found)
        digitalWrite(RED_LED, HIGH);
        tone(BUZZER, 800, 150);
        delay(150);
        tone(BUZZER, 800, 150);
        delay(700);
        digitalWrite(RED_LED, LOW);
      }
    } else {
      Serial.print("Error on sending POST request: ");
      Serial.println(httpResponseCode);
      // Connection Error Signal
      digitalWrite(RED_LED, HIGH);
      delay(1000);
      digitalWrite(RED_LED, LOW);
    }
    http.end();
  }
  
  mfrc522.PICC_HaltA();
  delay(1500); // Cooldown to avoid double scans
}
`;
  }, []);
  const [showQR, setShowQR] = useState(false);
  const [qrStudent, setQrStudent] = useState<User | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [feeBalances, setFeeBalances] = useState<{ [studentId: string]: number }>({});

  const studentStats = useMemo(() => {
    if (!students.length || !allAttendance.length) return [];

    return students.map(student => {
      const studentRecords = allAttendance.map(r => r.records[student.uid]).filter(Boolean);
      const total = studentRecords.length;
      const present = studentRecords.filter(r => r === 'present' || r === 'late').length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      return {
        ...student,
        total,
        present,
        percentage
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [students, allAttendance]);

  const myStats = useMemo(() => {
    if (!user || !studentStats) return null;
    return studentStats.find(s => s.uid === user.uid) || null;
  }, [studentStats, user]);

  const attendanceRecord = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return allAttendance.find(r => r.date === dateStr);
  }, [allAttendance, selectedDate]);

  const consecutiveAbsencesMap = useMemo(() => {
    const map: { [studentId: string]: number } = {};
    if (!students.length || !allAttendance.length) return map;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const allDatesSet = new Set(allAttendance.map(r => r.date));
    allDatesSet.add(dateStr);
    const sortedDates = Array.from(allDatesSet).sort();

    students.forEach(student => {
      let currentStreak = 0;
      for (const d of sortedDates) {
        let status: AttendanceStatus | undefined = undefined;
        if (d === dateStr) {
          status = attendance[student.uid];
        } else {
          const rec = allAttendance.find(r => r.date === d);
          status = rec?.records[student.uid];
        }

        if (status === 'absent') {
          currentStreak++;
        } else if (status) {
          currentStreak = 0;
        }
      }
      map[student.uid] = currentStreak;
    });

    return map;
  }, [students, allAttendance, attendance, selectedDate]);

  const criticalAbsentStudents = useMemo(() => {
    return students
      .map(s => ({ student: s, count: consecutiveAbsencesMap[s.uid] || 0 }))
      .filter(item => item.count >= 3)
      .sort((a, b) => b.count - a.count);
  }, [students, consecutiveAbsencesMap]);

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const isTeacher = userData?.role === 'teacher';
  const isAdmin = userData?.role === 'admin';
  const isStudent = userData?.role === 'student';

  const [isGpsVerifying, setIsGpsVerifying] = useState(false);
  const [gpsSelectedClassId, setGpsSelectedClassId] = useState('');
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayReason, setHolidayReason] = useState('Public Holiday');

  // Haversine formula to compute distance in meters
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleGpsCheckInOnClient = async (actionType: 'checkIn' | 'checkOut' = 'checkIn') => {
    if (!user || !userData) {
      addToast("User not authenticated.", "error");
      return;
    }

    if (actionType === 'checkOut') {
      const now = new Date();
      if (now.getHours() < 16) {
        if (!userData.earlyCheckoutAllowed) {
          addToast("Access Denied: Checked out prior to 4:00 PM is restricted unless with admin permission.", "error");
          return;
        }
      }
    }
    
    const targetClassId = gpsSelectedClassId || (userData.classIds && userData.classIds[0]);
    if (!targetClassId) {
      addToast("No assigned class selected to check in.", "error");
      return;
    }

    const targetClass = classes.find(c => c.id === targetClassId);
    if (!targetClass) {
      addToast("Selected class details could not be found.", "error");
      return;
    }

    if (targetClass.latitude === undefined || targetClass.latitude === null ||
        targetClass.longitude === undefined || targetClass.longitude === null) {
      addToast("GPS Geofencing is not configured/enabled for this class.", "error");
      return;
    }

    setIsGpsVerifying(true);
    addToast("Polled request: Checking location coordinates...", "success");

    const onGpsSuccess = async (position: GeolocationPosition) => {
      try {
        const studentLat = position.coords.latitude;
        const studentLon = position.coords.longitude;
        const targetLat = targetClass.latitude!;
        const targetLon = targetClass.longitude!;
        const allowedRadius = targetClass.radius || 100;

        const distance = getDistanceInMeters(studentLat, studentLon, targetLat, targetLon);

        if (distance > allowedRadius) {
          addToast(`Location error: You are ${Math.round(distance)}m from class (Required: < ${allowedRadius}m).`, "error");
          setIsGpsVerifying(false);
          return;
        }

        // Fee check first
        if (actionType === 'checkIn') {
          const feeQuery = query(collection(db, 'fee_balances'), where('studentId', '==', user.uid));
          const feeSnap = await getDocs(feeQuery);
          if (!feeSnap.empty) {
            const feeData = feeSnap.docs[0].data();
            if (feeData.balance > 0) {
              addToast(`Access Denied: You have unpaid fees (Balance: Kes ${feeData.balance}).`, "error");
              setIsGpsVerifying(false);
              return;
            }
          }
        }

        // Proceed with marking attendance
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        const timeStr = format(new Date(), 'HH:mm:ss');

        const q = query(
          collection(db, 'attendance'),
          where('date', '==', dateStr),
          where('classId', '==', targetClassId)
        );

        const snapshot = await getDocs(q);
        const logEntry = {
          time: timeStr,
          method: 'gps' as const
        };

        if (!snapshot.empty) {
          const todayRecord = snapshot.docs[0];
          const data = todayRecord.data() as AttendanceRecord;
          const updatedRecords = actionType === 'checkIn' 
            ? { ...data.records, [user.uid]: 'present' as const } 
            : data.records;

          const existingLogs = data.biometricLogs?.[user.uid] || {};
          const updatedLogs = {
            ...data.biometricLogs,
            [user.uid]: {
              ...existingLogs,
              [actionType]: logEntry
            }
          };

          await updateDoc(doc(db, 'attendance', todayRecord.id), {
            records: updatedRecords,
            biometricLogs: updatedLogs
          });
        } else {
          await addDoc(collection(db, 'attendance'), {
            classId: targetClassId,
            date: dateStr,
            records: { [user.uid]: actionType === 'checkIn' ? 'present' : 'absent' },
            biometricLogs: {
              [user.uid]: {
                [actionType]: logEntry
              }
            }
          });
        }

        addToast(`GPS check-in verified successfully for ${targetClass.name}!`, "success");
      } catch (error: any) {
        console.error("GPS check-in error:", error);
        addToast(error.message || "Failed to mark GPS attendance.", "error");
      } finally {
        setIsGpsVerifying(false);
      }
    };

    const tryGps = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        onGpsSuccess,
        (geoError) => {
          if (highAccuracy && (geoError.code === 3 || geoError.code === 2)) {
            // If high accuracy times out or is temporarily unavailable, attempt low accuracy instantly with durable settings
            addToast("Precision GPS timed out. Trying standard localization fallback...", "success");
            tryGps(false);
          } else {
            setIsGpsVerifying(false);
            const errMsg = geoError.code === 3 
              ? "GPS request timed out. Please ensure you are outdoors or next to a window and try again."
              : geoError.message || "Unable to acquire current location. Please grant GPS permissions.";
            addToast(errMsg, "error");
          }
        },
        { 
          enableHighAccuracy: highAccuracy, 
          timeout: highAccuracy ? 8000 : 25000, 
          maximumAge: highAccuracy ? 0 : 60000 
        }
      );
    };

    tryGps(true);
  };

  // Fetch classes based on role
  useEffect(() => {
    if (!user || !userData) return;
    
    const fetchClasses = async () => {
      try {
        let q;
        if (isAdmin || isTeacher) {
          q = query(collection(db, 'classes'));
        } else if (isStudent && userData.classIds && userData.classIds.length > 0) {
          q = query(collection(db, 'classes'), where('__name__', 'in', userData.classIds));
        } else {
          return;
        }

        const snapshot = await getDocs(q);
        const fetchedClasses = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Class));
        setClasses(fetchedClasses);
        if (fetchedClasses.length > 0 && !selectedClassId) {
          setSelectedClassId(fetchedClasses[0].id);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'classes');
      }
    };

    fetchClasses();
  }, [user, userData, isAdmin, isTeacher, isStudent]);

  // Fetch students for the selected class
  useEffect(() => {
    if (selectedClassId) {
      const fetchStudents = async () => {
        try {
          const q = query(collection(db, 'users'), where('classIds', 'array-contains', selectedClassId), where('role', '==', 'student'));
          const snapshot = await getDocs(q);
          const fetchedStudents = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
          setStudents(fetchedStudents);

          // Fetch fee balances for these students
          if (fetchedStudents.length > 0) {
            const studentIds = fetchedStudents.map(s => s.uid);
            const balances: { [studentId: string]: number } = {};
            
            // Chunk student IDs for Firestore 'in' query (max 10)
            for (let i = 0; i < studentIds.length; i += 10) {
              const chunk = studentIds.slice(i, i + 10);
              const feeQ = query(collection(db, 'fee_balances'), where('studentId', 'in', chunk));
              const feeSnap = await getDocs(feeQ);
              feeSnap.docs.forEach(d => {
                balances[d.data().studentId] = d.data().balance;
              });
            }
            setFeeBalances(balances);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'users');
        }
      };

      fetchStudents();
    }
  }, [selectedClassId]);

  // Fetch all attendance records for the selected class (for summary/history)
  useEffect(() => {
    if (selectedClassId) {
      const fetchAttendance = async () => {
        try {
          const q = query(
            collection(db, 'attendance'),
            where('classId', '==', selectedClassId),
            orderBy('date', 'desc')
          );

          const snapshot = await getDocs(q);
          const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
          
          // Automatically mark student as absent if they didn't checkout
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const currentHour = new Date().getHours();
          
          const normalizedRecords = await Promise.all(records.map(async (record) => {
            const isPastDate = record.date < todayStr;
            const isTodayAndPastCheckout = record.date === todayStr && currentHour >= 18; // After 6 PM today
            
            if (!isPastDate && !isTodayAndPastCheckout) {
              return record;
            }
            
            let updatedRecords = { ...record.records };
            let hasChanges = false;
            
            if (record.biometricLogs) {
              for (const studentId of Object.keys(record.biometricLogs)) {
                const logs = record.biometricLogs[studentId];
                if (logs?.checkIn && !logs?.checkOut) {
                  // Checked in but didn't checkout
                  if (updatedRecords[studentId] === 'present' || updatedRecords[studentId] === 'late') {
                    updatedRecords[studentId] = 'absent';
                    hasChanges = true;
                  }
                }
              }
            }
            
            if (hasChanges) {
              try {
                await updateDoc(doc(db, 'attendance', record.id), {
                  records: updatedRecords
                });
              } catch (err) {
                console.error("Error auto-updating missed checkout status:", record.id, err);
              }
              return {
                ...record,
                records: updatedRecords
              };
            }
            
            return record;
          }));

          setAllAttendance(normalizedRecords);
          
          // Also update current daily attendance if it matches selectedDate
          const dateStr = format(selectedDate, 'yyyy-MM-dd');
          const todayRecord = normalizedRecords.find(r => r.date === dateStr);
          if (todayRecord) {
            setAttendance(todayRecord.records);
          } else {
            setAttendance({});
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'attendance');
        }
      };

      fetchAttendance();
    }
  }, [selectedClassId, selectedDate]);

  // Fetch school calendar
  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const q = query(collection(db, 'school_calendar'));
        const snapshot = await getDocs(q);
        setSchoolCalendar(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCalendar)));
      } catch (error) {
        console.error("Error fetching school calendar:", error);
      }
    };

    fetchCalendar();
  }, []);

  const isSchoolClosed = useMemo(() => {
    // If it's closed globally, it's closed unless specifically overridden or if we want to allow reopening
    if (globalSettings?.isSchoolClosed) return true;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return schoolCalendar.some(c => c.date === dateStr && c.status === 'closed');
  }, [selectedDate, schoolCalendar, globalSettings]);

  const isGloballyClosed = globalSettings?.isSchoolClosed;

  const closedReason = useMemo(() => {
    if (globalSettings?.isSchoolClosed) return globalSettings.schoolClosedReason || 'Closed Indefinitely';
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return schoolCalendar.find(c => c.date === dateStr && c.status === 'closed')?.reason || 'Holiday / Special Event';
  }, [selectedDate, schoolCalendar, globalSettings]);

  const reopenSchoolGlobally = async () => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        isSchoolClosed: false,
        schoolReopenDate: ''
      });
      addToast("School reopened globally");
    } catch (error) {
      console.error("Error reopening school globally:", error);
      addToast("Failed to reopen school globally", "error");
    }
  };

  // WebUSB Detection & External Scanner Support
  useEffect(() => {
    const nav = navigator as any;
    if (!nav.usb) return;

    const handleConnect = (event: any) => {
      setUsbDevice(event.device);
      addToast(`External device connected: ${event.device.productName || 'Biometric Scanner'}`);
    };

    const handleDisconnect = (event: any) => {
      if (usbDevice?.serialNumber === event.device.serialNumber) {
        setUsbDevice(null);
        addToast("External scanner disconnected", "error");
      }
    };

    nav.usb.addEventListener('connect', handleConnect);
    nav.usb.addEventListener('disconnect', handleDisconnect);

    // Initial check
    nav.usb.getDevices().then((devices: any[]) => {
      if (devices.length > 0) setUsbDevice(devices[0]);
    }).catch((err: any) => {
      console.warn("WebUSB getDevices error:", err);
    });

    return () => {
      nav.usb.removeEventListener('connect', handleConnect);
      nav.usb.removeEventListener('disconnect', handleDisconnect);
    };
  }, [usbDevice]);

  const requestUsbScanner = async () => {
    const nav = navigator as any;
    if (!nav.usb) {
      addToast("WebUSB is not supported by your browser.", "error");
      return;
    }

    try {
      const device = await nav.usb.requestDevice({ filters: [] });
      setUsbDevice(device);
      addToast(`Hardware Linked: ${device.productName || 'External Scanner'}`);
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        console.error("USB Access Error:", error);
        addToast("Failed to connect to hardware scanner", "error");
      }
    }
  };

  const handleLinkExternalBiometric = async (studentId: string, hardwareId: string) => {
    if (!hardwareId.trim()) return;
    
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', studentId), {
        biometricId: `HW-${hardwareId.trim()}`,
        biometricLinkedAt: new Date().toISOString()
      });
      addToast("Record linked to hardware ID!");
      setExternalIdInput('');
      setSelectedStudentForBio(null);
    } catch (error) {
      addToast("Failed to link hardware ID", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveHolidayStatus = async (reasonText: string) => {
    if (!isAdmin && !isTeacher) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const displayReason = reasonText.trim() || 'Holiday / Special Event';
    
    try {
      setSaving(true);
      await setDoc(doc(db, 'school_calendar', dateStr), {
        id: dateStr,
        date: dateStr,
        status: 'closed',
        reason: displayReason
      });
      
      // Notify students
      try {
        const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        const batch = writeBatch(db);
        studentsSnap.docs.forEach(studentDoc => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            userId: studentDoc.id,
            title: 'School Closure: ' + displayReason,
            message: `The school will be closed on ${format(selectedDate, 'MMMM dd, yyyy')} due to ${displayReason}. Attendance is not required.`,
            type: 'announcement',
            read: false,
            createdAt: new Date().toISOString()
          });
        });
        await batch.commit();
        addToast(`School marked as closed (${displayReason}) and students notified`);
      } catch (notifError) {
        console.error("Error sending closure notifications:", notifError);
        addToast(`School marked as closed (${displayReason})`, "success");
      }
      setShowHolidayModal(false);
    } catch (error) {
      console.error("Error saving holiday status:", error);
      addToast("Failed to mark as closed", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleSchoolStatus = async () => {
    if (!isAdmin && !isTeacher) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existing = schoolCalendar.find(c => c.date === dateStr);
    
    try {
      if (existing) {
        if (existing.status === 'closed') {
          await deleteDoc(doc(db, 'school_calendar', existing.id));
          addToast("School marked as OPEN for this date");
        } else {
          await updateDoc(doc(db, 'school_calendar', existing.id), { status: 'closed' });
          addToast("School marked as CLOSED for this date");
        }
      } else {
        await setDoc(doc(db, 'school_calendar', dateStr), {
          id: dateStr,
          date: dateStr,
          status: 'closed',
          reason: 'Holiday / Special Event'
        });
        
        // Notify students
        try {
          const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
          const batch = writeBatch(db);
          studentsSnap.docs.forEach(studentDoc => {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
              userId: studentDoc.id,
              title: 'School Closed',
              message: `The school will be closed on ${format(selectedDate, 'MMMM dd, yyyy')}. Attendance is not required.`,
              type: 'announcement',
              read: false,
              createdAt: new Date().toISOString()
            });
          });
          await batch.commit();
          addToast("School CLOSED and students notified");
        } catch (notifError) {
          console.error("Error sending closure notifications:", notifError);
          addToast("School CLOSED (notifications failed)", "error");
        }
      }
    } catch (error) {
      console.error("Error toggling school status:", error);
      addToast("Failed to update school status", "error");
    }
  };

  // Hardware Scanner Listener (for HID Keyboard Emulation devices)
  useEffect(() => {
    if (!isScannerMode) return;
    
    let buffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore meta keys
      if (e.key.length > 1 && e.key !== 'Enter') return;
      
      if (e.key === 'Enter') {
        if (buffer.length > 3) {
          // If we are linking a student
          if (selectedStudentForBio) {
            handleLinkExternalBiometric(selectedStudentForBio, buffer);
          } else {
            // Check-in someone with this ID
            const targetStudent = students.find(s => s.biometricId === `HW-${buffer}` || s.biometricId === buffer);
            if (targetStudent) {
              handleBiometricCheckIn(targetStudent.uid);
            } else {
              addToast(`ID ${buffer} not recognized. Link it to a student first.`, "error");
            }
          }
        }
        buffer = '';
      } else {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScannerMode, selectedStudentForBio, students]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    if (!isTeacher && !isAdmin) return;
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleConfirmRefuseCheckout = async () => {
    if (!refusedCheckoutStudent || !refusalReason.trim() || !selectedClassId || !user) return;
    setSaving(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const timeStr = format(new Date(), 'HH:mm:ss');
    const studentUid = refusedCheckoutStudent.uid;

    try {
      const q = query(
        collection(db, 'attendance'),
        where('classId', '==', selectedClassId),
        where('date', '==', dateStr)
      );
      const snapshot = await getDocs(q);

      const logEntry = {
        time: timeStr,
        method: 'manual' as const,
        supervisorId: user.uid,
        refused: true,
        reason: refusalReason
      };

      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        const currentData = snapshot.docs[0].data() as AttendanceRecord;
        
        const updatedRecords = {
          ...currentData.records,
          [studentUid]: 'absent' as const
        };

        const existingLogs = currentData.biometricLogs?.[studentUid] || {};
        const updatedLogs = {
          ...currentData.biometricLogs,
          [studentUid]: {
            ...existingLogs,
            checkOut: logEntry
          }
        } as { 
          [studentId: string]: { 
            checkIn?: { time: string; method: 'qr' | 'biometric' | 'gps' | 'manual'; supervisorId?: string };
            checkOut?: { time: string; method: 'qr' | 'biometric' | 'gps' | 'manual'; supervisorId?: string; refused?: boolean; reason?: string };
            leaveOut?: { time: string; method: 'qr' | 'biometric' | 'gps' | 'manual'; supervisorId?: string; reason?: string; returnDate?: string };
          }; 
        };

        await updateDoc(doc(db, 'attendance', docId), {
          records: updatedRecords,
          biometricLogs: updatedLogs
        });
        
        setAttendance(updatedRecords);
        setAllAttendance(prev => prev.map(rec => {
          if (rec.id === docId) {
            return {
              ...rec,
              records: updatedRecords,
              biometricLogs: updatedLogs
            };
          }
          return rec;
        }));
      } else {
        const newDocRef = await addDoc(collection(db, 'attendance'), {
          classId: selectedClassId,
          date: dateStr,
          records: { [studentUid]: 'absent' },
          biometricLogs: {
            [studentUid]: {
              checkOut: logEntry
            }
          }
        });

        const newRecord: AttendanceRecord = {
          id: newDocRef.id,
          classId: selectedClassId,
          date: dateStr,
          records: { [studentUid]: 'absent' as const },
          biometricLogs: {
            [studentUid]: {
              checkOut: logEntry
            }
          } as { 
            [studentId: string]: { 
              checkIn?: { time: string; method: 'qr' | 'biometric' | 'gps' | 'manual'; supervisorId?: string };
              checkOut?: { time: string; method: 'qr' | 'biometric' | 'gps' | 'manual'; supervisorId?: string; refused?: boolean; reason?: string };
              leaveOut?: { time: string; method: 'qr' | 'biometric' | 'gps' | 'manual'; supervisorId?: string; reason?: string; returnDate?: string };
            }; 
          }
        };

        setAttendance({ [studentUid]: 'absent' as const });
        setAllAttendance(prev => [newRecord, ...prev]);
      }

      addToast(`Recorded refused check-out for ${refusedCheckoutStudent.name}. Status set to Absent.`);
      setRefusedCheckoutStudent(null);
      setRefusalReason('');
    } catch (error) {
      console.error("Error saving refused checkout", error);
      addToast("Failed to save refused checkout information", "error");
    } finally {
      setSaving(false);
    }
  };

  const triggerConsecutiveAbsenceNotifications = async (currentAttendance: { [studentId: string]: AttendanceStatus }) => {
    if (!selectedClassId) return;

    const currentClass = classes.find(c => c.id === selectedClassId);
    const targetTeacherId = currentClass?.teacherId;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const recordsMap: { [date: string]: { [studentId: string]: AttendanceStatus } } = {};
    
    allAttendance.forEach(rec => {
      recordsMap[rec.date] = { ...rec.records };
    });

    recordsMap[dateStr] = { ...currentAttendance };

    const sortedDates = Object.keys(recordsMap).sort();

    for (const student of students) {
      const studentId = student.uid;
      
      const statuses: AttendanceStatus[] = [];
      sortedDates.forEach(date => {
        const s = recordsMap[date][studentId];
        if (s) {
          statuses.push(s);
        }
      });

      let consecutiveCount = 0;
      for (let i = statuses.length - 1; i >= 0; i--) {
        if (statuses[i] === 'absent') {
          consecutiveCount++;
        } else {
          break;
        }
      }

      if (consecutiveCount > 3) {
        const title = `Critical Absence Alert: ${student.name}`;
        const message = `${student.name} has been marked absent for ${consecutiveCount} consecutive sessions in class "${currentClass?.name || 'Unknown Class'}".`;
        const recipientId = targetTeacherId || user?.uid;

        if (recipientId) {
          const notificationId = `attendance_alert_${studentId}_${selectedClassId}_${consecutiveCount}_${dateStr}`;
          try {
            await setDoc(doc(db, 'notifications', notificationId), {
              userId: recipientId,
              title,
              message,
              type: 'attendance',
              read: false,
              createdAt: new Date().toISOString(),
              senderId: user?.uid || 'system',
              link: `/attendance?classId=${selectedClassId}`
            });
            console.log(`Consecutive absence alert logged into DB for ${student.name}: ${consecutiveCount}`);
          } catch (err) {
            console.error("Error creating attendance notification record:", err);
          }
        }
      }
    }
  };

  const handleSave = async () => {
    if (!selectedClassId || (!isTeacher && !isAdmin)) return;
    setSaving(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const q = query(
        collection(db, 'attendance'),
        where('classId', '==', selectedClassId),
        where('date', '==', dateStr)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        await updateDoc(doc(db, 'attendance', snapshot.docs[0].id), {
          records: attendance
        });
      } else {
        await addDoc(collection(db, 'attendance'), {
          classId: selectedClassId,
          date: dateStr,
          records: attendance
        });
      }
      addToast("Attendance saved successfully!");
      await triggerConsecutiveAbsenceNotifications(attendance);
    } catch (error) {
      console.error("Error saving attendance:", error);
      addToast("Failed to save attendance", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkBiometric = async () => {
    if (!user || !userData) return;
    if (!isBiometricSupported()) {
      addToast("Biometrics not supported on this browser/device.", "error");
      return;
    }

    setIsLinkingDevice(true);
    try {
      const credential = await registerBiometric(userData.name, user.uid);
      await updateDoc(doc(db, 'users', user.uid), {
        biometricId: credential.credentialId,
        biometricRawId: credential.rawId,
        biometricLinkedAt: new Date().toISOString()
      });
      addToast("Phone fingerprint linked successfully!", "success");
    } catch (error: any) {
      console.error("Link Biometric Error:", error);
      addToast(error.message || "Failed to link biometric.", "error");
    } finally {
      setIsLinkingDevice(false);
    }
  };

  const handlePrintLeaveOutPermit = (eventLog: typeof lastEvent) => {
    if (!eventLog) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast("Failed to open print window. Please allow popups.", "error");
      return;
    }

    const schoolName = globalSettings?.schoolName || 'Breakthrough International';
    const logoHtml = globalSettings?.logoUrl 
      ? `<img src="${globalSettings.logoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: cover;" />`
      : `<span style="font-size: 24px; font-weight: bold; color: white;">${schoolName.charAt(0)}</span>`;

    const ticketId = `EXT-${Date.now().toString().slice(-6)}`;
    const reason = eventLog.reason || 'General Leave';
    const returnDateString = eventLog.returnDate || 'Not Specified';
    const authorizedBy = userData?.name || 'Authorized Officer';

    const html = `
      <html>
        <head>
          <title>Exit Permit - ${eventLog.student.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              padding: 40px; 
              color: #1e293b; 
              line-height: 1.5; 
              background-color: #ffffff;
            }
            .permit-container { 
              max-width: 650px; 
              margin: 0 auto; 
              border: 4px double #0f172a;
              padding: 30px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-title {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .logo-placeholder {
              width: 55px;
              height: 55px;
              background-color: #1e40af;
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .school-name {
              font-size: 18px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: -0.025em;
              margin: 0;
            }
            .subtitle {
              font-size: 11px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              margin: 2px 0 0 0;
            }
            .permit-id-block {
              text-align: right;
            }
            .label-xs {
              font-size: 10px;
              font-weight: 700;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 2px;
            }
            .val-bold {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
              margin: 0;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 25px;
            }
            .card-box {
              background-color: #f8fafc;
              padding: 15px;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            .card-box-accent {
              background-color: #eff6ff;
              padding: 15px;
              border-radius: 12px;
              border: 1px solid #dbeafe;
            }
            .footer-signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              border-top: 1px solid #cbd5e1;
              padding-top: 20px;
              margin-top: 35px;
            }
            .sig-line {
              border-bottom: 1px solid #0f172a;
              padding-bottom: 5px;
              font-weight: bold;
              font-size: 13px;
            }
            .bottom-note {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              font-weight: 600;
            }
            @media print {
              body { padding: 20px; }
              .permit-container { border: 4px double #000000; }
            }
          </style>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </head>
        <body>
          <div class="permit-container">
            <div class="header">
              <div class="logo-title">
                <div class="logo-placeholder">
                  ${logoHtml}
                </div>
                <div>
                  <h1 class="school-name">${schoolName}</h1>
                  <p class="subtitle">Student Exit Permit / Leave-Out</p>
                </div>
              </div>
              <div class="permit-id-block">
                <div class="label-xs">Permit ID</div>
                <p class="val-bold" style="color: #1e40af;">${ticketId}</p>
              </div>
            </div>

            <div class="grid-2">
              <div>
                <div class="label-xs">Student Name</div>
                <div class="val-bold" style="font-size: 16px; text-transform: uppercase;">${eventLog.student.name}</div>
              </div>
              <div>
                <div class="label-xs">Exit Time</div>
                <div class="val-bold" style="font-size: 16px;">${eventLog.time}</div>
              </div>
            </div>

            <div class="grid-2">
              <div>
                <div class="label-xs">Student ID/Email</div>
                <div class="val-bold" style="font-size: 13px; font-weight: 500; color: #475569;">${eventLog.student.email}</div>
              </div>
              <div>
                <div class="label-xs">Date</div>
                <div class="val-bold" style="font-size: 13px; font-weight: 500; color: #475569;">${format(new Date(), 'MMMM dd, yyyy')}</div>
              </div>
            </div>

            <div class="grid-2" style="margin-top: 10px;">
              <div class="card-box">
                <div class="label-xs" style="color: #64748b;">Reason for Leave-Out</div>
                <div class="val-bold" style="font-style: italic; font-weight: 600; color: #1e293b; font-size: 13px;">"${reason}"</div>
              </div>
              <div class="card-box-accent">
                <div class="label-xs" style="color: #2563eb;">Expected Return Date/Day</div>
                <div class="val-bold" style="color: #1e3a8a; font-size: 13px;">${returnDateString}</div>
              </div>
            </div>

            <div class="footer-signatures">
              <div>
                <div class="label-xs" style="margin-bottom: 30px;">Authorized By (Officer)</div>
                <div class="sig-line">${authorizedBy}</div>
              </div>
              <div>
                <div class="label-xs" style="margin-bottom: 30px;">School Stamp / Security Signature</div>
                <div class="sig-line" style="min-height: 20px;"></div>
              </div>
            </div>

            <div class="bottom-note">
              This permit is valid only for the stated date and time above.
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleBiometricCheckIn = async (targetStudentId?: string) => {
    // If targetUid is provided, it's supervisor-led. 
    // Otherwise it's the current user (used if the user meant students can still auto-check in at a kiosk)
    const targetUid = targetStudentId || (isStudent ? user?.uid : null);
    if (!targetUid || !user || !userData) return;
    
    // Create attendance record function to be reused by QR and biometric
    const markAttendance = async (uid: string, action: 'checkIn' | 'checkOut' | 'leaveOut' = 'checkIn') => {
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const timeStr = format(new Date(), 'HH:mm:ss');
      
      const studentData = students.find(s => s.uid === uid) || (isStudent ? userData : null);
      if (!studentData) return;

      // Restrict Early Checkout to pre-4:00 PM unless with admin permission (supervisor-led or flag earlyCheckoutAllowed is true)
      if (action === 'checkOut' || action === 'leaveOut') {
        const now = new Date();
        if (now.getHours() < 16) {
          const isSupervisorLed = isAdmin || isTeacher;
          if (!isSupervisorLed && !studentData.earlyCheckoutAllowed) {
            addToast(`Access Denied: Checked out prior to 4:00 PM is restricted for ${studentData.name} unless permitted by administrator.`, "error");
            return null;
          }
        }
      }

      // Fee Check for Check-In
      if (action === 'checkIn') {
        try {
          const feeQuery = query(collection(db, 'fee_balances'), where('studentId', '==', uid));
          const feeSnap = await getDocs(feeQuery);
          if (!feeSnap.empty) {
            const feeData = feeSnap.docs[0].data();
            if (feeData.balance > 0) {
              addToast(`Access Denied: ${studentData.name} has unpaid fees (Balance: ${feeData.balance})`, "error");
              return null;
            }
          }
        } catch (feeErr) {
          console.error("Fee Check Error:", feeErr);
        }
      }

      const targetClassId = studentData?.classIds?.[0] || selectedClassId;
      if (!targetClassId) return;

      const q = query(
        collection(db, 'attendance'),
        where('date', '==', dateStr),
        where('classId', '==', targetClassId)
      );
      
      const snapshot = await getDocs(q);
      const logEntry: any = {
        time: timeStr,
        method: (isQRScannerMode ? 'qr' : 'biometric') as 'qr' | 'biometric',
        supervisorId: (isAdmin || isTeacher) ? user.uid : undefined
      };
      if (action === 'leaveOut') {
        logEntry.reason = leaveReason;
        logEntry.returnDate = returnDate;
      }
      
      if (!snapshot.empty) {
        const todayRecord = snapshot.docs[0];
        const data = todayRecord.data() as AttendanceRecord;
        
        // If checking in, also mark as present
        const updatedRecords = action === 'checkIn' ? { ...data.records, [uid]: 'present' as const } : data.records;
        
        const existingLogs = data.biometricLogs?.[uid] || {};
        const updatedLogs = { 
          ...data.biometricLogs, 
          [uid]: { 
            ...existingLogs,
            [action]: logEntry
          } 
        };
        
        await updateDoc(doc(db, 'attendance', todayRecord.id), {
          records: updatedRecords,
          biometricLogs: updatedLogs
        });
      } else {
        await addDoc(collection(db, 'attendance'), {
          classId: targetClassId,
          date: dateStr,
          records: { [uid]: action === 'checkIn' ? 'present' : 'absent' },
          biometricLogs: { 
            [uid]: { 
              [action]: logEntry
            } 
          }
        });
      }

      setLastEvent({
        student: studentData,
        action,
        time: timeStr,
        reason: action === 'leaveOut' ? leaveReason : undefined,
        returnDate: action === 'leaveOut' ? returnDate : undefined
      });

      return studentData.name;
    };

    // Who is verifying? The supervisor (Admin/Teacher) or the Student itself
    const verifier = userData;
    
    // For biometric, we need the verifier to have a biometric ID
    if (!isQRScannerMode && !verifier.biometricId) {
      addToast(isAdmin || isTeacher ? "Please link your phone fingerprint in Settings first." : "Please link your device biometrics first.", "error");
      return;
    }

    setIsVerifyingBiometric(true);
    
    try {
      if (!isQRScannerMode) {
        const verified = await verifyBiometric(verifier.biometricId!);
        if (!verified) {
          addToast("Biometric verification failed.", "error");
          return;
        }
      }

      const name = await markAttendance(targetUid, currentAction);
      if (name) {
        addToast(`Verified ${currentAction} for ${name}`);
        setSelectedStudentForBio(null);
      }
    } catch (error: any) {
      console.error("Verification Error:", error);
      addToast(error.message || "Verification Failed", "error");
    } finally {
      setIsVerifyingBiometric(false);
    }
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let timer: NodeJS.Timeout;
    
    const startScanner = async () => {
      const element = document.getElementById("qr-reader");
      if (!element) {
        console.warn("QR reader element not found");
        return;
      }

      try {
        setScannerError(false);
        // Check if cameras are available
        const cameras = await Html5Qrcode.getCameras().catch(err => {
          console.error("getCameras error", err);
          return [];
        });

        if (cameras.length === 0) {
          addToast("No cameras found on this device.", "error");
          setScannerError(true);
          return;
        }

        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };
        
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          async (decodedText) => {
            // Success callback
            if (saving) return;
            
            setSaving(true);
            try {
              const student = students.find(s => s.uid === decodedText);
              if (student) {
                // Fee Check for Check-In
                if (currentAction === 'checkIn') {
                  const feeQuery = query(collection(db, 'fee_balances'), where('studentId', '==', student.uid));
                  const feeSnap = await getDocs(feeQuery);
                  if (!feeSnap.empty) {
                    const feeData = feeSnap.docs[0].data();
                    if (feeData.balance > 0) {
                      addToast(`Access Denied: ${student.name} has unpaid fees`, "error");
                      setSaving(false);
                      return;
                    }
                  }
                }

                const dateStr = format(new Date(), 'yyyy-MM-dd');
                const timeStr = format(new Date(), 'HH:mm:ss');
                
                const q = query(
                  collection(db, 'attendance'),
                  where('date', '==', dateStr),
                  where('classId', '==', selectedClassId)
                );
                
                const snapshot = await getDocs(q);
                const logEntry: any = {
                  time: timeStr,
                  method: 'qr' as const,
                  supervisorId: user?.uid
                };
                if (currentAction === 'leaveOut') {
                  logEntry.reason = leaveReason;
                  logEntry.returnDate = returnDate;
                }

                if (!snapshot.empty) {
                  const docRef = doc(db, 'attendance', snapshot.docs[0].id);
                  const data = snapshot.docs[0].data() as AttendanceRecord;
                  const existingLogs = data.biometricLogs?.[student.uid] || {};
                  
                  if (existingLogs[currentAction as keyof typeof existingLogs]) {
                    addToast(`${student.name} already has a ${currentAction} recorded.`, "error");
                  } else {
                    const updates: any = {
                      [`biometricLogs.${student.uid}.${currentAction}`]: logEntry
                    };
                    if (currentAction === 'checkIn') {
                      updates[`records.${student.uid}`] = 'present';
                    }
                    
                    await updateDoc(docRef, updates);
                    addToast(`Recorded ${currentAction} for ${student.name}`);
                    setLastEvent({
                      student,
                      action: currentAction,
                      time: timeStr,
                      reason: currentAction === 'leaveOut' ? leaveReason : undefined,
                      returnDate: currentAction === 'leaveOut' ? returnDate : undefined
                    });
                  }
                } else {
                  await addDoc(collection(db, 'attendance'), {
                    classId: selectedClassId,
                    date: dateStr,
                    records: { [student.uid]: currentAction === 'checkIn' ? 'present' : 'absent' },
                    biometricLogs: {
                      [student.uid]: {
                        [currentAction]: logEntry
                      }
                    }
                  });
                  addToast(`Recorded ${currentAction} for ${student.name}`);
                  setLastEvent({
                    student,
                    action: currentAction,
                    time: timeStr,
                    reason: currentAction === 'leaveOut' ? leaveReason : undefined,
                    returnDate: currentAction === 'leaveOut' ? returnDate : undefined
                  });
                }
              } else {
                addToast("QR Code recognized, but student not found in this class.", "error");
              }
            } catch (err) {
              console.error("QR Scan Mark Error:", err);
              addToast("Failed to record event via QR", "error");
            } finally {
              setTimeout(() => setSaving(false), 2000);
            }
          },
          () => {} // Quiet on noise
        );
      } catch (err: any) {
        console.error("Unable to start QR scanner:", err);
        setScannerError(true);
        // Only toast if we're still in QR mode
        if (isQRScannerMode) {
          const msg = err?.message || err || "";
          if (msg.includes("Permission denied")) {
            addToast("Camera access denied. Please allow camera permissions in your browser.", "error");
          } else {
            addToast("Camera error: Could not start. Check permissions and device.", "error");
          }
        }
      }
    };

    if (isQRScannerMode) {
      // Small delay to ensure the element is in the DOM after the conditional render
      timer = setTimeout(startScanner, 500);
    }

    return () => {
      clearTimeout(timer);
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            html5QrCode?.clear();
          }).catch(e => console.log("cleanup error", e));
        } else {
          try {
            html5QrCode.clear();
          } catch(e) {}
        }
      }
    };
  }, [isQRScannerMode, students, selectedClassId, user?.uid, saving]);

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700 border-green-200';
      case 'absent': return 'bg-red-100 text-red-700 border-red-200';
      case 'late': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'excused': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return <CheckCircle size={14} />;
      case 'absent': return <XCircle size={14} />;
      case 'late': return <Clock size={14} />;
      case 'excused': return <AlertCircle size={14} />;
      default: return null;
    }
  };

  const currentClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* Inject Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: fixed; left: 0; top: 0; width: 100%; height: 100%; display: flex !important; background: white; z-index: 9999; }
          @page { size: portrait; margin: 1cm; }
          .no-print { display: none !important; }
          table { width: 100% !important; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}} />

      {!isStudent ? (
        <>
          {/* Header & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Class Attendance</h1>
              <p className="text-gray-500 text-sm">Monitor and record student presence</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* View Toggles */}
              <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm overflow-x-auto max-w-full">
                {(isAdmin || isTeacher) && (
                  <>
                    <div className="flex items-center gap-1 group relative">
                      <button
                        onClick={usbDevice ? () => setUsbDevice(null) : requestUsbScanner}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                          usbDevice ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50 border border-transparent'
                        }`}
                        title={usbDevice ? `Connected: ${usbDevice.productName}` : "Search for USB Hardware"}
                      >
                        <Smartphone size={14} className={usbDevice ? 'animate-pulse' : ''} />
                        {usbDevice ? 'USB Connected' : 'Pair USB'}
                      </button>
                      {usbDevice && (
                        <button 
                          onClick={async () => {
                            try {
                              if (usbDevice.forget) await usbDevice.forget();
                              setUsbDevice(null);
                              addToast("Device unpaired/forgotten");
                            } catch (e) {
                              setUsbDevice(null);
                            }
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          title="Unpair Device"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setIsScannerMode(!isScannerMode);
                        setIsQRScannerMode(false);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                        isScannerMode ? 'bg-amber-600 text-white shadow-md' : 'text-amber-600 hover:bg-amber-50'
                      }`}
                    >
                      <Fingerprint size={18} />
                      {isScannerMode ? 'Exit Bio' : 'Biometric'}
                    </button>
                    <button
                      onClick={() => {
                        setIsQRScannerMode(!isQRScannerMode);
                        setIsScannerMode(false);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                        isQRScannerMode ? 'bg-blue-800 text-white shadow-md' : 'text-blue-800 hover:bg-blue-50'
                      }`}
                    >
                      <QrCode size={18} />
                      {isQRScannerMode ? 'Exit QR' : 'QR Scanner'}
                    </button>
                    <button
                      onClick={() => setShowNodeMcuPortal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap text-purple-600 hover:bg-purple-50 border border-purple-100"
                    >
                      <Cpu size={18} />
                      NodeMCU IoT
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViewMode('daily')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'daily' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Calendar size={18} />
                  Daily
                </button>
                <button
                  onClick={() => setViewMode('summary')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'summary' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <BarChart2 size={18} />
                  Summary
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <List size={18} />
                  History
                </button>
                <button
                  onClick={() => setViewMode('report')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'report' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <BarChart2 size={18} />
                  Report
                </button>
              </div>

              {/* Class Selector */}
              {(isAdmin || isTeacher) && (
                <div className="flex items-center gap-2">
                  {classes.length > 1 && (
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block p-2.5 shadow-sm"
                    >
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Printable Exit Permit */}
      {lastEvent && lastEvent.action === 'leaveOut' && (
        <div className="hidden print:flex print-section fixed inset-0 bg-white p-12 flex-col items-center">
          <div className="w-full max-w-2xl border-4 border-double border-gray-900 p-8">
            <div className="flex justify-between items-start mb-8 pb-8 border-b-2 border-gray-900">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-800 rounded-2xl flex items-center justify-center text-white font-bold text-2xl overflow-hidden shadow-lg border-2 border-blue-900">
                  {globalSettings?.logoUrl ? (
                    <img src={globalSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    globalSettings?.schoolName?.charAt(0) || 'S'
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tighter">{globalSettings?.schoolName || 'Breakthrough International'}</h1>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Student Exit Permit / Leave-Out</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Permit ID</p>
                <p className="text-sm font-bold text-gray-900">EXT-{Date.now().toString().slice(-6)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-12">
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Student Name</p>
                  <p className="text-lg font-bold text-gray-900 uppercase">{lastEvent.student.name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Student ID/Email</p>
                  <p className="text-sm font-bold text-gray-700">{lastEvent.student.email}</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Exit Time</p>
                  <p className="text-lg font-bold text-gray-900">{lastEvent.time}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Date</p>
                  <p className="text-sm font-bold text-gray-700">{format(new Date(), 'MMMM dd, yyyy')}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-12">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Reason for Leave-Out</p>
                <p className="text-sm font-bold text-gray-900 italic">"{lastEvent.reason || 'General Leave'}"</p>
              </div>
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Expected Return Date/Day</p>
                <p className="text-sm font-bold text-blue-900">{lastEvent.returnDate || 'Not Specified'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-12">
              <div className="border-t border-gray-400 pt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8">Authorized By (Officer)</p>
                <p className="text-sm font-bold text-gray-900 border-b border-gray-900 pb-1">{userData?.name}</p>
              </div>
              <div className="border-t border-gray-400 pt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8">School Stamp / Security Signature</p>
                <div className="h-10"></div>
              </div>
            </div>

            <div className="mt-12 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">This permit is valid only for the stated date and time above.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
          <AnimatePresence mode="wait">
            {isQRScannerMode ? (
              <motion.div
                key="qr-scanner"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden max-w-2xl mx-auto no-print"
              >
                <div className="bg-blue-800 p-8 text-white relative">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-3xl font-bold uppercase tracking-tight">QR ID Scanner</h2>
                        <p className="text-blue-100 font-medium">Class: {currentClass?.name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {currentClass?.startTime && (
                          <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20 text-xs font-bold uppercase">
                            {currentClass.startTime} - {currentClass.endTime}
                          </div>
                        )}
                        <span className="text-xs font-bold uppercase bg-blue-600 px-2 py-1 rounded">{currentAction} Mode</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <QrCode size={120} />
                  </div>
                </div>

                <div className="p-8">
                  {/* Action Toggles */}
                  <div className="flex justify-center mb-8 bg-gray-50 p-1 rounded-2xl border border-gray-100">
                    {(['checkIn', 'checkOut', 'leaveOut'] as const).map((action) => (
                      <button
                        key={action}
                        onClick={() => setCurrentAction(action)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                          currentAction === action 
                            ? 'bg-blue-800 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {action === 'checkIn' && <CheckCircle size={16} />}
                        {action === 'checkOut' && <XCircle size={16} />}
                        {action === 'leaveOut' && <AlertCircle size={16} />}
                        {action.replace(/([A-Z])/, ' $1')}
                      </button>
                    ))}
                  </div>

                  {currentAction === 'leaveOut' && (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-400 mb-2 tracking-widest">Leave Reason</label>
                        <input 
                          type="text"
                          value={leaveReason || ''}
                          onChange={(e) => setLeaveReason(e.target.value)}
                          placeholder="e.g. Hospital visit..."
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-400 mb-2 tracking-widest">Expected Return</label>
                        <input 
                          type="text"
                          value={returnDate || ''}
                          onChange={(e) => setReturnDate(e.target.value)}
                          placeholder="e.g. Tomorrow 4PM, Monday..."
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-blue-900"
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-900 rounded-3xl overflow-hidden aspect-square max-w-sm mx-auto shadow-2xl relative border-4 border-white">
                    <div id="qr-reader" className="w-full h-full"></div>
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                       <div className="w-64 h-64 border-2 border-blue-400 opacity-50 rounded-2xl animate-pulse" />
                    </div>
                    {/* Error Overlay if camera fails to start */}
                    {scannerError && (
                      <div id="qr-error-placeholder" className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white p-6 z-20">
                        <div className="text-center space-y-4">
                          <div className="bg-red-500/20 p-4 rounded-full text-red-400 inline-block">
                            <XCircle size={32} />
                          </div>
                          <p className="text-sm font-bold">Camera failed to start</p>
                          <p className="text-xs text-gray-400 uppercase">Check permissions or device hardware</p>
                          <button 
                            onClick={() => {
                              setScannerError(false);
                              setIsQRScannerMode(false);
                              setTimeout(() => setIsQRScannerMode(true), 200);
                            }}
                            className="bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/40"
                          >
                            Retry Camera
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-8 text-center space-y-4">
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-full text-blue-800 border border-blue-100">
                      <Camera size={18} />
                      <span className="text-xs font-bold uppercase tracking-widest">Camera Tracking Active</span>
                    </div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Position the student's QR code within the frame</p>
                  </div>

                  {lastEvent && lastEvent.action === 'leaveOut' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between no-print"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                          <Check size={24} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 uppercase tracking-tight">Success: {lastEvent.student.name}</p>
                          <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">Leave-out recorded at {lastEvent.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handlePrintLeaveOutPermit(lastEvent)}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-200"
                        >
                          Print Permit
                        </button>
                        <button 
                          onClick={() => setLastEvent(null)}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Class: {classes.find(c => c.id === selectedClassId)?.name}</span>
                  </div>
                  <button
                    onClick={() => setIsQRScannerMode(false)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-900 uppercase tracking-widest"
                  >
                    Stop Scanner
                  </button>
                </div>
              </motion.div>
            ) : isScannerMode ? (
              <motion.div
                key="scanner"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden max-w-4xl mx-auto no-print"
              >
            <div className="bg-amber-600 p-8 text-white relative">
              <div className="relative z-10">
                <h2 className="text-3xl font-bold uppercase tracking-tight">Supervisor Scanner</h2>
                <p className="text-amber-100 font-medium">Verify students using your device fingerprint</p>
              </div>
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Fingerprint size={120} />
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Select Student to Verify</label>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {students.map(student => {
                      const isVerified = attendanceRecord?.biometricLogs?.[student.uid];
                      return (
                        <button
                          key={student.uid}
                          onClick={() => setSelectedStudentForBio(student.uid)}
                          className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${
                            selectedStudentForBio === student.uid 
                              ? 'border-amber-600 bg-amber-50 shadow-md ring-2 ring-amber-100' 
                              : isVerified 
                                ? 'border-emerald-100 bg-emerald-50 opacity-60'
                                : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isVerified ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{student.name}</p>
                              {isVerified && (
                                <p className="text-xs text-emerald-600 font-bold uppercase tracking-tight">
                                  Last: {isVerified.checkIn?.time || isVerified.leaveOut?.time || isVerified.checkOut?.time}
                                </p>
                              )}
                            </div>
                          </div>
                          {isVerified && <CheckCircle size={20} className="text-emerald-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  {selectedStudentForBio ? (
                    <div className="space-y-6">
                      <div className="w-24 h-24 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-xl shadow-amber-100">
                        <Fingerprint size={48} />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-gray-900 uppercase">Confirm Identity</h4>
                        <p className="text-sm text-gray-500 font-medium">Use your biometric sensor to verify <span className="text-amber-600 font-bold">{students.find(s => s.uid === selectedStudentForBio)?.name}</span></p>
                      </div>
                      <button
                        onClick={() => handleBiometricCheckIn(selectedStudentForBio)}
                        disabled={isVerifyingBiometric}
                        className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl hover:bg-amber-700 transition-all shadow-xl shadow-amber-100 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isVerifyingBiometric ? (
                          <>
                            <RefreshCw size={20} className="animate-spin" />
                            Authorizing...
                          </>
                        ) : (
                          <>
                            <Smartphone size={20} />
                            Verify Student
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedStudentForBio(null)}
                        className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-20 h-20 rounded-full bg-gray-100 text-gray-300 flex items-center justify-center mx-auto">
                        <UserIcon size={40} />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Select a student from the list<br/>to begin verification</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Scanner Active</span>
                </div>
                {userData?.biometricId && (
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                    Linked: {user?.email}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsScannerMode(false)}
                className="text-xs font-bold text-gray-500 hover:text-gray-900 uppercase tracking-widest"
              >
                Close Scanner
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            {viewMode === 'daily' && (
              <motion.div
                key="daily"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Date Selector */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-center bg-white border border-gray-200 rounded-2xl p-4 shadow-sm max-w-md mx-auto w-full">
                    <button
                      onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div className="flex-1 text-center">
                      <div className="flex items-center justify-center gap-2 font-bold text-gray-900">
                        <Calendar className="text-blue-600" size={20} />
                        {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
                      </div>
                      {isSameDay(selectedDate, new Date()) && (
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest leading-none">Today</span>
                      )}
                      {isWeekend(selectedDate) && (
                        <span className="text-xs font-bold text-orange-600 uppercase tracking-widest ml-2 leading-none">Weekend</span>
                      )}
                      {isSchoolClosed && (
                        <span className="text-xs font-bold text-red-600 uppercase tracking-widest ml-2 leading-none">School Closed</span>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </div>

                  {(isAdmin || isTeacher) && (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={isGloballyClosed ? reopenSchoolGlobally : (isSchoolClosed ? toggleSchoolStatus : () => { setHolidayReason('Public Holiday'); setShowHolidayModal(true); })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                          isSchoolClosed 
                            ? 'bg-green-50 text-green-600 border border-green-100 hover:bg-green-100/80 active:scale-95' 
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100/80 active:scale-95'
                        }`}
                      >
                        {isSchoolClosed ? <Unlock size={14} /> : <Calendar size={14} />}
                        {isGloballyClosed 
                          ? 'Re-open School Globally' 
                          : (isSchoolClosed ? 'Re-open School for this date' : 'Mark Holiday / Closure')
                        }
                      </button>
                      {isGloballyClosed && isAdmin && (
                        <p className="text-xs text-blue-500 font-bold uppercase tracking-tight">School is currently in Holiday Mode</p>
                      )}
                    </div>
                  )}
                </div>

                {isSchoolClosed ? (
                  <div className={`border rounded-[32px] p-12 text-center max-w-2xl mx-auto flex flex-col items-center gap-4 ${
                    closedReason.toLowerCase().includes('holiday')
                      ? 'bg-blue-50/50 border-blue-100/80 shadow-sm shadow-blue-50'
                      : 'bg-red-50 border-red-100'
                  }`}>
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${
                      closedReason.toLowerCase().includes('holiday')
                        ? 'bg-blue-100 text-blue-600 shadow-blue-100/50'
                        : 'bg-red-100 text-red-600 shadow-red-100/50'
                    }`}>
                      {closedReason.toLowerCase().includes('holiday') ? <Calendar size={40} /> : <Lock size={40} />}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                        {closedReason.toLowerCase().includes('holiday') ? '🏖️ Official Holiday' : 'School is Closed'}
                      </h3>
                      <p className="text-gray-600 font-bold max-w-sm text-sm">
                        {closedReason}
                      </p>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-1">
                        Attendance recording is suspended for this date
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Real-time Consecutive Absence Warning Panel */}
                    {criticalAbsentStudents.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-3 shadow-sm mb-4"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600 animate-pulse">
                            <AlertCircle size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-rose-950 uppercase tracking-wider">Critical Real-time Absence Watch</h4>
                            <p className="text-[11px] text-rose-600 font-semibold leading-tight">Students with 3 or more consecutive absent sessions</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-1">
                          {criticalAbsentStudents.map(({ student, count }) => (
                            <div key={`crit_${student.uid}`} className="flex items-center justify-between bg-white/70 backdrop-blur-sm border border-rose-100/50 rounded-xl p-3 shadow-xs">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-extrabold text-slate-800">{student.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{student.admissionNumber || 'No ADM'}</span>
                              </div>
                              <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-1 rounded-lg ${
                                count > 3 ? 'bg-red-500 text-white animate-bounce' : 'bg-amber-500 text-white'
                              }`}>
                                {count} Days Abs.
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                            {(isTeacher || isAdmin) && (
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {students.map((student) => {
                            const status = attendance[student.uid];
                            return (
                              <tr key={`${student.uid}_${student.email}`} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                                      {student.name.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-gray-900">{student.name}</p>
                                        {student.admissionNumber && (
                                          <p className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit uppercase tracking-tight">
                                            {student.admissionNumber}
                                          </p>
                                        )}
                                        {consecutiveAbsencesMap[student.uid] >= 3 && (
                                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-xs font-bold uppercase animate-pulse ${
                                            consecutiveAbsencesMap[student.uid] > 3 
                                              ? 'bg-rose-50 border-rose-100 text-rose-600' 
                                              : 'bg-amber-50 border-amber-100 text-amber-600'
                                          }`}>
                                            <AlertCircle size={10} />
                                            {consecutiveAbsencesMap[student.uid]} absences
                                          </div>
                                        )}
                                        {feeBalances[student.uid] > 0 && (
                                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 border border-red-100 text-xs font-bold uppercase text-red-600 animate-pulse">
                                            <AlertCircle size={10} />
                                            Fees Due
                                          </div>
                                        )}
                                        {(isAdmin || isTeacher) && (
                                          <button 
                                            onClick={() => setQrStudent(student)}
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            title="View Student QR ID"
                                          >
                                            <QrCode size={14} />
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs text-gray-500">{student.email}</p>
                                          {attendanceRecord?.biometricLogs?.[student.uid] && (
                                            <div className="flex flex-wrap gap-1">
                                              {attendanceRecord.biometricLogs[student.uid].checkIn && (
                                                <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase" title={`Check-in via ${attendanceRecord.biometricLogs[student.uid].checkIn?.method}`}>
                                                  {attendanceRecord.biometricLogs[student.uid].checkIn?.method === 'biometric' ? <Fingerprint size={10} /> : <CheckCircle size={10} />}
                                                  {attendanceRecord.biometricLogs[student.uid].checkIn?.time}
                                                </div>
                                              )}
                                              {attendanceRecord.biometricLogs[student.uid].checkOut && (
                                                <div 
                                                  className={`flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded border uppercase cursor-help ${
                                                    attendanceRecord.biometricLogs[student.uid].checkOut?.refused 
                                                      ? 'text-rose-700 bg-rose-100 border-rose-200' 
                                                      : 'text-red-600 bg-red-50 border-red-100'
                                                  }`}
                                                  title={
                                                    attendanceRecord.biometricLogs[student.uid].checkOut?.refused 
                                                      ? `Refused Checkout: ${attendanceRecord.biometricLogs[student.uid].checkOut?.reason}` 
                                                      : "Check-out"
                                                  }
                                                >
                                                  <XCircle size={10} />
                                                  {attendanceRecord.biometricLogs[student.uid].checkOut?.refused ? 'Refused' : attendanceRecord.biometricLogs[student.uid].checkOut?.time}
                                                </div>
                                              )}
                                              {attendanceRecord.biometricLogs[student.uid].leaveOut && (
                                                <div className="flex items-center gap-1.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 text-amber-600">
                                                  <div className="flex items-center gap-1 text-xs font-bold uppercase" title="Leave-out">
                                                    <AlertCircle size={10} />
                                                    {attendanceRecord.biometricLogs[student.uid].leaveOut?.time}
                                                  </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const log = attendanceRecord.biometricLogs[student.uid].leaveOut;
                                                    handlePrintLeaveOutPermit({
                                                      student: student,
                                                      action: 'leaveOut',
                                                      time: log?.time || '',
                                                      reason: log?.reason || 'General Leave',
                                                      returnDate: log?.returnDate || 'Not Specified'
                                                    });
                                                  }}
                                                  className="text-amber-700 hover:text-amber-900 focus:outline-none transition-colors border-l border-amber-200 pl-1.5 ml-1 flex items-center cursor-pointer"
                                                  title="Print Exit Permit"
                                                >
                                                  <Printer size={10} />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      {(isAdmin || isTeacher) && (
                                          <button 
                                            onClick={() => setSelectedStudentForBio(student.uid)}
                                            className={`mt-2 flex items-center gap-2 px-2 py-1 rounded text-xs font-bold uppercase tracking-widest transition-all ${
                                              student.biometricId 
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                                : 'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100'
                                            }`}
                                          >
                                            <Fingerprint size={10} />
                                            {student.biometricId ? 'Bio Linked' : 'Enroll Bio'}
                                          </button>
                                        )}
                                        {attendanceRecord?.biometricLogs?.[student.uid]?.checkOut?.refused && (
                                          <div className="mt-2 bg-red-50/70 border border-red-100 rounded-xl p-2.5 max-w-xs shadow-xs text-left">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-widest mb-1 font-sans">
                                              <AlertCircle size={12} className="text-red-600 animate-pulse" />
                                              <span>Refused Checkout</span>
                                            </div>
                                            <p className="text-xs text-red-650 leading-relaxed font-semibold italic">
                                              "{attendanceRecord.biometricLogs[student.uid].checkOut.reason}"
                                            </p>
                                          </div>
                                        )}
                                        {attendanceRecord?.biometricLogs?.[student.uid]?.checkIn && !attendanceRecord?.biometricLogs?.[student.uid]?.checkOut && status === 'absent' && (
                                          <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-2.5 max-w-xs shadow-xs text-left">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-widest mb-1 font-sans">
                                              <AlertCircle size={12} className="text-amber-500" />
                                              <span>Missed Checkout</span>
                                            </div>
                                            <p className="text-xs text-amber-600 leading-relaxed">
                                              Student checked in but missed checking out. Automatically marked as Absent.
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex justify-center">
                                    {status ? (
                                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${getStatusColor(status)} shadow-sm`}>
                                        {status === 'present' ? 'P' : status === 'absent' ? 'A' : status === 'late' ? 'L' : 'E'}
                                      </span>
                                    ) : (
                                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-100 flex items-center justify-center">
                                        <span className="text-xs text-gray-300 font-bold">?</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                {(isTeacher || isAdmin) && (
                                  <td className="px-6 py-4">
                                    <div className="flex justify-center gap-2">
                                      {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((s) => (
                                        <button
                                          key={s}
                                          onClick={() => handleStatusChange(student.uid, s)}
                                          className={`p-2 rounded-lg border transition-all ${
                                            status === s 
                                              ? getStatusColor(s) + ' shadow-sm' 
                                              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                          }`}
                                          title={s.charAt(0).toUpperCase() + s.slice(1)}
                                        >
                                          {getStatusIcon(s) || <Check size={14} />}
                                        </button>
                                      ))}
                                      <button
                                        onClick={() => {
                                          setRefusedCheckoutStudent(student);
                                          setRefusalReason('');
                                        }}
                                        className={`p-2 rounded-lg border transition-all flex items-center gap-1.5 font-bold uppercase shrink-0 ${
                                          attendanceRecord?.biometricLogs?.[student.uid]?.checkOut?.refused
                                            ? 'bg-rose-100 text-rose-700 border-rose-350 shadow-xs'
                                            : 'bg-white hover:bg-rose-50 text-rose-500 border-rose-200 hover:border-rose-300 shadow-xs'
                                        }`}
                                        title="Refuse Checkout (Mark as Absent with Reason)"
                                      >
                                        <XCircle size={14} />
                                        <span className="text-[10px] tracking-wider hidden md:inline">Refuse CO</span>
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                          {students.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">
                                No students found in this class.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {(isTeacher || isAdmin) && students.length > 0 && (
                      <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex items-center gap-2 bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                        >
                          <Save size={20} />
                          {saving ? 'Saving...' : 'Save Attendance'}
                        </button>
                      </div>
                    )}
                  </div>
                  </>
                )}
              </motion.div>
            )}

            {viewMode === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {studentStats.map((stat) => (
                  <div key={`${stat.uid}_summary_card`} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                        {stat.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{stat.name}</h3>
                        <p className="text-xs text-gray-500">{stat.email}</p>
                      </div>
                      <div className={`text-xl font-bold ${stat.percentage >= 75 ? 'text-green-600' : stat.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {stat.percentage}%
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Attendance Rate</span>
                        <span>{stat.present} / {stat.total} days</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stat.percentage}%` }}
                          className={`h-full rounded-full ${stat.percentage >= 75 ? 'bg-green-500' : stat.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {studentStats.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                    No attendance statistics available for this class.
                  </div>
                )}
              </motion.div>
            )}

            {viewMode === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Present</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Absent</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Late/Excused</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {allAttendance.map((record) => {
                        const stats = Object.values(record.records).reduce((acc, status) => {
                          acc[status] = (acc[status] || 0) + 1;
                          return acc;
                        }, {} as any);

                        return (
                          <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-gray-900">
                              {format(new Date(record.date), 'MMM dd, yyyy')}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-green-600 font-bold">{stats.present || 0}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-red-600 font-bold">{stats.absent || 0}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-yellow-600 font-bold">{stats.late || 0}</span> / <span className="text-blue-600 font-bold">{stats.excused || 0}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <button
                                  onClick={() => {
                                    setSelectedDate(new Date(record.date));
                                    setViewMode('daily');
                                  }}
                                  className="text-blue-600 hover:text-blue-700 text-sm font-bold flex items-center gap-1"
                                >
                                  View Details
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {allAttendance.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                            No attendance history available for this class.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {viewMode === 'report' && (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Report Controls */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm print:hidden">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setReportMonth(subDays(startOfMonth(reportMonth), 1))}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="font-bold text-gray-900 min-w-[150px] text-center">
                      {format(reportMonth, 'MMMM yyyy')}
                    </span>
                    <button
                      onClick={() => setReportMonth(addDays(endOfMonth(reportMonth), 1))}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
                  >
                    <Save size={18} />
                    Print Report
                  </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print-section print:border-0 print:shadow-none print:m-0 print:p-0">
                  <div className="p-8 hidden print:block border-b border-gray-100 mb-6 font-sans">
                    <div className="flex justify-between items-start">
                      <div>
                        <h1 className="text-3xl font-bold text-gray-900 uppercase">Attendance Register</h1>
                        <p className="text-lg font-bold text-blue-600">{classes.find(c => c.id === selectedClassId)?.name}</p>
                        <p className="text-gray-500 font-medium">{format(reportMonth, 'MMMM yyyy')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Generated Date</p>
                        <p className="text-sm font-bold text-gray-900">{format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left border-collapse print:text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 sticky left-0 bg-gray-50 z-10 w-48 print:static print:bg-white print:w-auto">
                            Student Name
                          </th>
                          {eachDayOfInterval({
                            start: startOfMonth(reportMonth),
                            end: endOfMonth(reportMonth)
                          }).map(day => (
                            <th 
                              key={day.toString()} 
                              className={`px-1 py-3 text-xs font-bold uppercase tracking-wider text-center border-r border-gray-100 min-w-[30px] print:min-w-0 ${
                                isWeekend(day) ? 'bg-orange-50 text-orange-600' : 'text-gray-400'
                              }`}
                            >
                              {format(day, 'd')}
                              <div className={`text-xs font-normal ${isWeekend(day) ? 'text-orange-400' : 'text-gray-400'} print:hidden`}>
                                {format(day, 'EEE').charAt(0)}
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center bg-blue-50 print:bg-gray-50">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {students.map(student => {
                          const monthDays = eachDayOfInterval({
                            start: startOfMonth(reportMonth),
                            end: endOfMonth(reportMonth)
                          });
                          
                          let presentCount = 0;
                          let totalMarked = 0;

                          return (
                            <tr key={student.uid} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                              <td className="px-4 py-3 text-sm font-bold text-gray-900 border-r border-gray-200 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] print:static print:shadow-none print:text-xs">
                                {student.name}
                              </td>
                              {monthDays.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const record = allAttendance.find(r => r.date === dateStr);
                                const status = record?.records[student.uid];
                                
                                if (status) {
                                  totalMarked++;
                                  if (status === 'present' || status === 'late') presentCount++;
                                }

                                return (
                                  <td 
                                    key={day.toString()} 
                                    className={`px-0 py-3 text-center border-r border-gray-50 ${isWeekend(day) ? 'bg-orange-50/30' : ''}`}
                                  >
                                    {status === 'present' && <span className="text-xs font-bold text-green-600">P</span>}
                                    {status === 'absent' && <span className="text-xs font-bold text-red-600">A</span>}
                                    {status === 'late' && <span className="text-xs font-bold text-yellow-600">L</span>}
                                    {status === 'excused' && <span className="text-xs font-bold text-blue-600">E</span>}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-sm font-bold text-center bg-blue-50 text-blue-600 print:bg-gray-50 print:text-black print:text-xs">
                                {totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : '-'}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="p-6 bg-gray-50 border-t border-gray-100 print:bg-white print:p-2 print:border-t-0">
                    <div className="flex flex-wrap gap-6 text-xs print:gap-4 print:text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-green-50 text-green-600 font-bold text-xs border border-green-100">P</span>
                        <span className="text-gray-600 font-medium">Present</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-red-50 text-red-600 font-bold text-xs border border-red-100">A</span>
                        <span className="text-gray-600 font-medium">Absent</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-yellow-50 text-yellow-600 font-bold text-xs border border-yellow-100">L</span>
                        <span className="text-gray-600 font-medium">Late</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100">E</span>
                        <span className="text-gray-600 font-medium">Excused</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </>
  ) : (
    <div className="space-y-8 pb-12">
      {/* Student Welcome Header */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[40px] p-8 sm:p-12 text-white shadow-2xl shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/10 rounded-full blur-[100px]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner group overflow-hidden">
              {userData?.photoUrl ? (
                <img src={userData.photoUrl} alt="Me" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={48} className="text-white group-hover:scale-110 transition-transform" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-blue-100 font-bold uppercase tracking-widest text-[10px]">Academic Portfolio</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Your Attendance</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-blue-50 text-sm font-medium opacity-80">Last update: {format(new Date(), 'HH:mm')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-6 py-5 rounded-[28px] border border-white/20 flex flex-col items-center gap-3 min-w-[200px]">
            <div className="flex items-center gap-2.5">
               <Fingerprint size={20} className="text-blue-200" />
               <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100">Verification Status</span>
            </div>
            <div className="flex items-center gap-2">
               {attendanceRecord?.biometricLogs?.[user.uid] ? (
                 <div className="bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-4 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-widest backdrop-blur-xl">
                   <div className="w-2 h-2 rounded-full bg-emerald-400" /> Verified
                 </div>
               ) : (
                 <div className="bg-amber-500/30 text-amber-300 border border-amber-500/40 px-4 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-widest backdrop-blur-xl">
                    <div className="w-2 h-2 rounded-full bg-amber-400" /> Pending Scan
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Quick Stats Sidebar */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm flex flex-col items-center text-center group">
               <div className="relative mb-6">
                 <svg className="w-32 h-32 transform -rotate-90">
                   <circle
                     className="text-gray-100"
                     strokeWidth="10"
                     stroke="currentColor"
                     fill="transparent"
                     r="54"
                     cx="64"
                     cy="64"
                   />
                   <motion.circle
                     className={myStats?.percentage && myStats.percentage >= 75 ? "text-emerald-500" : "text-amber-500"}
                     strokeWidth="10"
                     strokeDasharray={339.292}
                     initial={{ strokeDashoffset: 339.292 }}
                     animate={{ strokeDashoffset: 339.292 - ((myStats?.percentage || 0) / 100) * 339.292 }}
                     strokeLinecap="round"
                     stroke="currentColor"
                     fill="transparent"
                     r="54"
                     cx="64"
                     cy="64"
                   />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-3xl font-extrabold text-gray-900 tracking-tight">{myStats?.percentage || 0}%</span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rate</span>
                 </div>
               </div>
               <h3 className="font-bold text-gray-900 uppercase tracking-tight text-sm">Course Progress</h3>
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Sessions attended: {myStats?.present || 0} / {myStats?.total || 0}</p>
          </div>

          <div 
            onClick={() => setShowQR(true)}
            className="group bg-slate-900 p-8 rounded-[40px] shadow-xl hover:shadow-slate-200 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
               <QrCode size={100} />
            </div>
            <div className="relative z-10">
               <div className="flex justify-between items-start mb-10">
                 <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                   <QrCode size={24} />
                 </div>
                 <div className="bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Identity</div>
               </div>
               <h3 className="text-white font-bold tracking-tight text-xl mb-1">Student QR ID</h3>
               <p className="text-slate-400 text-xs font-medium leading-relaxed">Touchless verification for smart attendance kiosks.</p>
               <div className="mt-8 flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/5">
                 <div className="bg-white p-1 rounded-lg">
                    <QRCodeCanvas value={user.uid} size={48} level="M" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-white uppercase tracking-widest truncate">{userData?.studentId || user.uid.substring(0, 8)}</p>
                    <p className="text-slate-500 text-[10px] font-medium">Click to expand</p>
                 </div>
               </div>
            </div>
          </div>

          {/* GPS Location Self Attendance Check-In */}
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
            <h3 className="font-bold text-gray-900 uppercase tracking-tight text-xs flex items-center gap-2">
               <MapPin size={15} className="text-purple-600 animate-pulse" /> GPS Location Check-In
            </h3>
            
            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
              Verify your physical workspace location inside the class geofence limits to mark yourself present immediately.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">Select Enrolled Class</label>
                <select
                  value={gpsSelectedClassId}
                  onChange={(e) => setGpsSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 text-slate-800 rounded-2xl px-4 py-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 transition-all font-sans"
                >
                  <option value="">-- Choose one of your classes --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.latitude ? ' (GPS enabled)' : ' (GPS disabled)'}
                    </option>
                  ))}
                </select>
              </div>

              {gpsSelectedClassId && (() => {
                const currentCls = classes.find(c => c.id === gpsSelectedClassId);
                if (!currentCls) return null;
                const hasGps = currentCls.latitude !== undefined && currentCls.latitude !== null;
                return (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-3xl space-y-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasGps ? 'bg-purple-600 animate-pulse' : 'bg-rose-500'}`}></span>
                      Geofence Status
                    </p>
                    <p className="text-xs font-semibold text-slate-800">
                      {hasGps 
                        ? `Configured to: ${currentCls.latitude?.toFixed(4)}, ${currentCls.longitude?.toFixed(4)}` 
                        : 'No geofence coordinates specified for this class.'}
                    </p>
                    {hasGps && (
                      <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded border border-purple-100 inline-block">
                        Radius: {currentCls.radius || 100} meters
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={isGpsVerifying || !gpsSelectedClassId || !classes.find(c => c.id === gpsSelectedClassId)?.latitude}
                  onClick={() => handleGpsCheckInOnClient('checkIn')}
                  className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-transparent transition-all rounded-2xl text-xs font-extrabold text-white uppercase tracking-wider text-center shadow-lg shadow-purple-100 disabled:shadow-none min-h-[50px] flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                >
                  {isGpsVerifying ? (
                    <span className="flex items-center gap-1">Checking...</span>
                  ) : (
                    <span>Check In</span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isGpsVerifying || !gpsSelectedClassId || !classes.find(c => c.id === gpsSelectedClassId)?.latitude}
                  onClick={() => handleGpsCheckInOnClient('checkOut')}
                  className="flex-1 py-4 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-100 transition-all rounded-2xl text-xs font-extrabold uppercase tracking-wider text-center min-h-[50px] flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                >
                  Check Out
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-bold text-gray-900 uppercase tracking-tight text-xs flex items-center gap-2">
               <Info size={14} className="text-blue-500" /> Support info
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">To mark attendance, ensure your biometric profile is updated or present your QR code to your facilitator.</p>
            <button className="w-full py-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl text-[10px] font-bold text-gray-900 uppercase tracking-widest border border-gray-100">
               View Policy
            </button>
          </div>
        </div>

        {/* Main Attendance Activity */}
        <div className="lg:col-span-3 space-y-8">
          {/* Monthly Heatmap Calendar */}
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl p-8 sm:p-10">
            <div className="flex items-center justify-between mb-8 px-2">
              <h3 className="font-bold text-gray-900 uppercase tracking-tight text-sm flex items-center gap-3">
                <Calendar size={18} className="text-primary" />
                Attendance Heatmap
              </h3>
              <div className="flex gap-4">
                 <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-emerald-500" />
                   <span className="text-[9px] font-bold text-gray-400 uppercase">Present</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-rose-500" />
                   <span className="text-[9px] font-bold text-gray-400 uppercase">Absent</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-3">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{day}</div>
              ))}
              {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() - 1 }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {eachDayOfInterval({ 
                start: startOfMonth(new Date()), 
                end: endOfMonth(new Date()) 
              }).map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const record = allAttendance.find(r => r.date === dateStr);
                const status = record?.records[user.uid];
                
                let bgColor = 'bg-gray-50';
                let textColor = 'text-gray-400';
                let ringColor = 'ring-transparent';

                if (status === 'present' || status === 'late') {
                  bgColor = 'bg-emerald-50';
                  textColor = 'text-emerald-700';
                  ringColor = 'ring-emerald-200';
                } else if (status === 'absent') {
                  bgColor = 'bg-rose-50';
                  textColor = 'text-rose-700';
                  ringColor = 'ring-rose-200';
                } else if (status === 'excused') {
                  bgColor = 'bg-amber-50';
                  textColor = 'text-amber-700';
                  ringColor = 'ring-amber-200';
                } else if (isWeekend(day)) {
                  bgColor = 'bg-slate-50 text-slate-300 opacity-40';
                }

                return (
                  <motion.div 
                    whileHover={{ scale: 1.1 }}
                    key={dateStr} 
                    className={`aspect-square rounded-xl sm:rounded-2xl flex flex-col items-center justify-center group relative transition-all ring-1 ${ringColor} ${bgColor}`}
                  >
                    <span className={`text-[10px] sm:text-xs font-bold ${textColor}`}>{format(day, 'd')}</span>
                    {status && (
                       <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                         status === 'present' || status === 'late' ? 'bg-emerald-500' :
                         status === 'absent' ? 'bg-rose-500' : 'bg-amber-500'
                       }`} />
                    )}
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 pointer-events-none">
                       <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shadow-xl">
                         {format(day, 'MMM dd')}: {status ? status.toUpperCase() : 'NO CLASS'}
                       </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 uppercase tracking-tight text-sm flex items-center gap-3">
                 <HistoryIcon size={18} className="text-emerald-500" />
                 Recent Activity Logs
              </h3>
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                <BarChart2 size={20} />
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {allAttendance.filter(r => r.biometricLogs?.[user.uid]).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10).map((record, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={record.id} 
                  className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors group"
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                      record.records[user.uid] === 'present' ? 'bg-emerald-50 text-emerald-600' :
                      record.records[user.uid] === 'late' ? 'bg-amber-50 text-amber-600' :
                      'bg-rose-50 text-rose-600'
                    }`}>
                      {record.records[user.uid] === 'absent' ? <XCircle size={28} /> : <CheckCircle size={28} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-base font-bold text-gray-900 tracking-tight">{format(new Date(record.date), 'EEEE, MMM dd')}</p>
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                           record.records[user.uid] === 'present' ? 'bg-emerald-100 text-emerald-600' :
                           record.records[user.uid] === 'late' ? 'bg-amber-100 text-amber-600' :
                           'bg-rose-100 text-rose-600'
                        }`}>{record.records[user.uid]}</span>
                      </div>
                      <div className="flex gap-4">
                        {record.biometricLogs?.[user.uid]?.checkIn && (
                          <div className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" />
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Entry: <span className="text-emerald-600">{record.biometricLogs[user.uid]?.checkIn?.time}</span></p>
                          </div>
                        )}
                        {record.biometricLogs?.[user.uid]?.checkOut && (
                          <div className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" />
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Exit: <span className="text-rose-600">{record.biometricLogs[user.uid]?.checkOut?.time}</span></p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Verified Log</span>
                    <RefreshCw size={14} className="text-gray-200 group-hover:animate-spin transition-colors group-hover:text-emerald-500" />
                  </div>
                </motion.div>
              ))}
              {allAttendance.filter(r => r.biometricLogs?.[user.uid]).length === 0 && (
                <div className="p-20 text-center space-y-4">
                   <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                     <AlertCircle size={40} />
                   </div>
                   <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No biometric activity recorded yet.</p>
                </div>
              )}
            </div>
            {allAttendance.filter(r => r.biometricLogs?.[user.uid]).length > 10 && (
               <div className="p-4 bg-gray-50 text-center">
                  <button className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline">View Older Logs</button>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )}

      <AnimatePresence>
        {(showQR || qrStudent) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print"
            onClick={() => {
              setShowQR(false);
              setQrStudent(null);
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-10 max-w-sm w-full shadow-2xl relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
              
              <button 
                onClick={() => {
                  setShowQR(false);
                  setQrStudent(null);
                }}
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <XCircle size={24} />
              </button>

              <div className="text-center space-y-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">
                    {qrStudent ? "Student QR ID" : "My Student QR ID"}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-1">
                    {qrStudent ? qrStudent.name : userData?.name}
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border-2 border-dashed border-gray-100 inline-block shadow-inner">
                  <QRCodeCanvas value={qrStudent?.uid || user?.uid || ''} size={200} level="H" includeMargin />
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-2xl flex items-center justify-center gap-3 text-blue-600">
                    <QrCode size={20} />
                    <span className="text-xs font-bold uppercase tracking-widest">Touchless Check-in</span>
                  </div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    {qrStudent 
                      ? "The student can scan this if they forgot their phone" 
                      : "Present this for scanning at the classroom"}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mark Holiday / School Closure Modal */}
      <AnimatePresence>
        {showHolidayModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print"
            onClick={() => {
              setShowHolidayModal(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-gray-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
              
              <button 
                onClick={() => {
                  setShowHolidayModal(false);
                }}
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <XCircle size={24} />
              </button>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-md">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 uppercase tracking-tight text-left">Mark Holiday / Closure</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider text-left">
                      Date: {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Holiday Reason / Description</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-gray-800 bg-white"
                      placeholder="e.g. Mashujaa Day, Christmas Break, staff development, etc."
                      value={holidayReason}
                      onChange={(e) => setHolidayReason(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Presets</label>
                    <div className="flex flex-wrap gap-2 font-sans">
                      {['National Holiday', 'Public Holiday', 'Sabbath / Sunday', 'End of Term Break', 'Mashujaa Day', 'Madaraka Day', 'Jamhuri Day', 'Boxing Day', 'Good Friday', 'Easter Monday', 'Labour Day'].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setHolidayReason(preset)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                            holidayReason === preset 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 flex gap-3 text-yellow-800">
                    <Info size={20} className="shrink-0 mt-0.5" />
                    <p className="text-xs font-medium leading-normal">
                      Closing the school on this date will notify all students that attendance is not required for this date.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => setShowHolidayModal(false)}
                    className="px-5 py-3 border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveHolidayStatus(holidayReason)}
                    disabled={saving}
                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-600/25 hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    {saving ? 'Saving...' : 'Mark Closed/Holiday'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Biometric Enrollment Modal */}
      <AnimatePresence>
        {selectedStudentForBio && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudentForBio(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm no-print"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 no-print"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-blue-800 p-8 text-white">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Fingerprint size={28} />
                  </div>
                  <button onClick={() => setSelectedStudentForBio(null)} className="text-white/60 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>
                <h3 className="text-2xl font-bold uppercase tracking-tight leading-none mb-2">Biometric Enrollment</h3>
                <p className="text-blue-100 font-medium text-sm">
                  Linking: <span className="font-bold underline">{students.find(s => s.uid === selectedStudentForBio)?.name}</span>
                </p>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex items-center justify-center w-6 h-6 bg-emerald-600 rounded-full text-white text-xs font-bold">1</div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 uppercase tracking-tight">External Hardware Scan</p>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed mt-1">
                          Connect scanner, focus this box, and scan the student's fingerprint.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="relative">
                        <input 
                          type="text"
                          value={externalIdInput || ''}
                          onChange={(e) => setExternalIdInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleLinkExternalBiometric(selectedStudentForBio, externalIdInput);
                          }}
                          placeholder="Scan to capture hardware ID..."
                          className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none pr-10 text-slate-900"
                          autoFocus
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300">
                          <RefreshCw size={16} className={saving ? 'animate-spin' : ''} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`p-5 rounded-2xl border transition-all ${isBiometricSupported() ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex items-center justify-center w-6 h-6 bg-amber-600 rounded-full text-white text-xs font-bold">2</div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 uppercase tracking-tight">Device Native Biometrics</p>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed mt-1">
                          Use the device's internal fingerprint/face scanner (if supported).
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleLinkBiometric}
                      disabled={isLinkingDevice || !isBiometricSupported()}
                      className="mt-4 w-full bg-amber-600 text-white font-bold uppercase tracking-widest text-xs py-3 rounded-xl hover:bg-amber-700 transition-all disabled:opacity-50 shadow-lg shadow-amber-200"
                    >
                      {isLinkingDevice ? 'Authenticating...' : !isBiometricSupported() ? 'Not Supported' : 'Launch System Scanner'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setSelectedStudentForBio(null)}
                    className="flex-1 bg-gray-100 text-gray-600 font-bold uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleLinkExternalBiometric(selectedStudentForBio, externalIdInput)}
                    disabled={!externalIdInput || saving}
                    className="flex-1 bg-blue-800 text-white font-bold uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-blue-900 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Link Resource'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Refused Checkout Explanation Modal */}
      <AnimatePresence>
        {refusedCheckoutStudent && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setRefusedCheckoutStudent(null);
                setRefusalReason('');
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs no-print"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 z-10 no-print"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-red-700 p-8 text-white">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                    <XCircle size={28} />
                  </div>
                  <button 
                    onClick={() => {
                      setRefusedCheckoutStudent(null);
                      setRefusalReason('');
                    }} 
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <h3 className="text-2xl font-bold uppercase tracking-tight leading-none mb-2">Refused Checkout</h3>
                <p className="text-red-100 font-medium text-sm">
                  Student: <span className="font-bold underline">{refusedCheckoutStudent.name}</span>
                </p>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Reason for Refusing Checkout
                  </label>
                  <textarea
                    rows={4}
                    value={refusalReason}
                    onChange={(e) => setRefusalReason(e.target.value)}
                    placeholder="Enter the reason why the student refused or was unable to properly checkout..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all resize-none text-slate-800 font-medium"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setRefusedCheckoutStudent(null);
                      setRefusalReason('');
                    }}
                    className="flex-1 bg-gray-100 text-gray-600 font-bold uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-gray-200 transition-all border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleConfirmRefuseCheckout}
                    disabled={!refusalReason.trim() || saving}
                    className="flex-1 bg-red-650 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-xs py-4 rounded-2xl transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                  >
                    {saving ? 'Recording...' : 'Mark Absent'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NodeMCU IoT Integration Portal Modal */}
      <AnimatePresence>
        {showNodeMcuPortal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNodeMcuPortal(false)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-[32px] shadow-2xl overflow-hidden max-w-3xl w-full border border-slate-100 z-10 flex flex-col relative max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-900 text-white p-6 relative">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl">
                      <Cpu size={28} className="text-purple-300" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight leading-tight">NodeMCU ESP8266 IoT Link</h3>
                      <p className="text-purple-200 text-xs font-semibold leading-relaxed">Connect external smart RFID physical barriers or turnstiles</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowNodeMcuPortal(false)}
                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-gray-100 bg-gray-50/50 p-2 gap-1 overflow-x-auto">
                {(['overview', 'arduino', 'wiring', 'api'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setNodeMcuTab(tab)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      nodeMcuTab === tab 
                        ? 'bg-purple-600 text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
                {nodeMcuTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                      <h4 className="font-bold text-sm text-purple-950 uppercase tracking-wider mb-1">Autonomous IoT Gateways</h4>
                      <p className="text-xs text-purple-800 leading-relaxed font-semibold">
                        By deploying inexpensive ESP8266 NodeMCU or ESP32 microcontrollers, you can install real physical attendance stations outside classrooms, libraries, or school gates. When a scanner reads a tag or card pin, it updates our servers instantaneously!
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border border-slate-100 bg-slate-50 rounded-[20px] flex gap-3">
                        <div className="p-2 bg-rose-100 rounded-xl text-rose-600 h-fit"><AlertCircle size={18} /></div>
                        <div>
                          <h5 className="font-extrabold text-xs uppercase tracking-tight text-slate-900">Unpaid Fees Lock</h5>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">Financial Gates</p>
                          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                            NodeMCU requests screen outstanding fee accounts directly. If a student is in default, the LED flares solid <span className="text-rose-600 font-bold underline">RED</span> and locks barrier access!
                          </p>
                        </div>
                      </div>

                      <div className="p-4 border border-slate-100 bg-slate-50 rounded-[20px] flex gap-3">
                        <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600 h-fit"><CheckCircle size={18} /></div>
                        <div>
                          <h5 className="font-extrabold text-xs uppercase tracking-tight text-slate-900">Seamless Processing</h5>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">Offline Kiosk Integration</p>
                          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                            Students present their smart RFID tags or scan fingerprints. Server registers their presence, sending instant live alerts across user screens.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {nodeMcuTab === 'arduino' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-900 text-gray-400 px-4 py-2 rounded-t-xl text-xs font-mono font-bold">
                      <span>RFID_ESP8266_Gate.ino</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(arduinoCodeString);
                          addToast("Source Code Copied!", "success");
                        }}
                        className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 uppercase tracking-wider bg-purple-950/50 px-2 py-1 rounded"
                      >
                        Copy Code
                      </button>
                    </div>
                    <pre className="p-4 bg-gray-950 rounded-b-xl overflow-x-auto text-[10px] font-mono text-emerald-400 border border-gray-900 max-h-[350px]">
                      <code>{arduinoCodeString}</code>
                    </pre>
                  </div>
                )}

                {nodeMcuTab === 'wiring' && (
                  <div className="space-y-4">
                    <h4 className="font-black text-xs uppercase tracking-wider text-slate-500">MFRC522 RFID to NodeMCU V3 Pinout</h4>
                    <div className="overflow-hidden border border-slate-100 rounded-2xl">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest font-black text-[10px]">
                          <tr>
                            <th className="px-4 py-3">MFRC522 Connection Pin</th>
                            <th className="px-4 py-3">NodeMCU ESP8266 Equivalent</th>
                            <th className="px-4 py-3">Purpose</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          <tr>
                            <td className="px-4 py-3 font-bold">SDA (SS)</td>
                            <td className="px-4 py-3 text-purple-600 font-bold">D4 (GPIO 2)</td>
                            <td className="px-4 py-3 text-slate-400">SPI Slave Select</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-bold">SCK</td>
                            <td className="px-4 py-3 text-purple-600 font-bold">D5 (GPIO 14)</td>
                            <td className="px-4 py-3 text-slate-400">SPI Clock Signals</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-bold">MOSI</td>
                            <td className="px-4 py-3 text-purple-600 font-bold">D7 (GPIO 13)</td>
                            <td className="px-4 py-3 text-slate-400">Master Out Slave In</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-bold">MISO</td>
                            <td className="px-4 py-3 text-purple-600 font-bold">D6 (GPIO 12)</td>
                            <td className="px-4 py-3 text-slate-400">Master In Slave Out</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-bold">GND</td>
                            <td className="px-4 py-3 text-slate-900 font-bold">GND</td>
                            <td className="px-4 py-3 text-slate-400">Ground Line Reference</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-bold">RST</td>
                            <td className="px-4 py-3 text-purple-600 font-bold">D3 (GPIO 0)</td>
                            <td className="px-4 py-3 text-slate-400">Reset Signal Pin</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-bold">3.3V</td>
                            <td className="px-4 py-3 text-red-600 font-bold">3V3</td>
                            <td className="px-4 py-3 text-slate-400">Power Input (DO NOT connect to 5V!)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {nodeMcuTab === 'api' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-sm uppercase tracking-wider text-slate-900">IoT Communication Handshake APIs</h4>
                    
                    <div className="space-y-4 font-mono text-xs">
                      <div className="p-4 bg-slate-900 text-slate-200 rounded-xl space-y-1">
                        <span className="bg-emerald-500 text-white text-[10px] uppercase px-1.5 py-0.5 rounded font-black">POST</span>
                        <div className="font-bold text-white leading-loose overflow-x-auto whitespace-nowrap">
                          {window.location.origin}/api/nodemcu/attendance
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans mt-2 leading-relaxed">
                          Marks checkIn / checkOut / leaveOut depending on `action` parameter. Supported parameters:
                          <ul className="list-disc pl-5 mt-1 text-slate-400 space-y-0.5">
                            <li><strong>biometricId</strong> or <strong>uid</strong>: RFID card serial / device biometric ID</li>
                            <li><strong>action</strong>: <code className="text-amber-300">"checkIn"</code>, <code className="text-amber-300">"checkOut"</code>, or <code className="text-amber-300">"leaveOut"</code> (default checkIn)</li>
                            <li><strong>format</strong>: set to <code className="text-amber-300">"text"</code> for plain-text responses</li>
                          </ul>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-900 text-slate-200 rounded-xl space-y-1">
                        <span className="bg-emerald-500 text-white text-[10px] uppercase px-1.5 py-0.5 rounded font-black">POST</span>
                        <div className="font-bold text-white leading-loose overflow-x-auto whitespace-nowrap">
                          {window.location.origin}/api/nodemcu/link
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans mt-2 leading-relaxed">
                          Links an RFID chip serial or Fingerprint ID to a student's profile:
                          <ul className="list-disc pl-5 mt-1 text-slate-400 space-y-0.5">
                            <li><strong>studentId</strong>: The unique Firestore ID of the student</li>
                            <li><strong>hardwareId</strong>: The scannable hex of the RFID raw tag</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Close Action */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowNodeMcuPortal(false)}
                  className="bg-purple-600 text-white font-black uppercase text-xs py-3 px-6 rounded-xl hover:bg-purple-700 transition"
                >
                  Close Setup Portal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
