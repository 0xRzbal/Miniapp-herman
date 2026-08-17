import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SCHEDULE_FILE = path.join(__dirname, '..', 'data', 'schedules.json');

function loadSchedules() {
  try {
    if (existsSync(SCHEDULE_FILE)) {
      return JSON.parse(readFileSync(SCHEDULE_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveSchedules(schedules) {
  const dir = path.dirname(SCHEDULE_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
}

export function getSchedules() {
  return loadSchedules();
}

export function addSchedule(toolId, args, cron) {
  const schedules = loadSchedules();
  const task = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    toolId,
    args,
    cron,
    enabled: true,
    lastRun: null,
    nextRun: calculateNextRun(cron),
    createdAt: new Date().toISOString(),
  };
  schedules.push(task);
  saveSchedules(schedules);
  return task;
}

export function removeSchedule(id) {
  const schedules = loadSchedules();
  const index = schedules.findIndex(s => s.id === id);
  if (index === -1) return false;
  schedules.splice(index, 1);
  saveSchedules(schedules);
  return true;
}

export function toggleSchedule(id) {
  const schedules = loadSchedules();
  const task = schedules.find(s => s.id === id);
  if (!task) return null;
  task.enabled = !task.enabled;
  saveSchedules(schedules);
  return task;
}

function calculateNextRun(cron) {
  const now = new Date();
  const parts = cron.split(' ');
  if (parts.length !== 5) return new Date(now.getTime() + 60000).toISOString();
  const [minute, hour] = parts;
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.slice(2));
    return new Date(now.getTime() + interval * 60000).toISOString();
  }
  if (hour.startsWith('*/')) {
    const interval = parseInt(hour.slice(2));
    return new Date(now.getTime() + interval * 3600000).toISOString();
  }
  const next = new Date(now);
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next.toISOString();
}

export function checkAndRunScheduledTasks(runTask) {
  const schedules = loadSchedules();
  const now = new Date();
  for (const task of schedules) {
    if (!task.enabled || !task.nextRun) continue;
    const nextRun = new Date(task.nextRun);
    if (now >= nextRun) {
      runTask(task);
      task.lastRun = now.toISOString();
      task.nextRun = calculateNextRun(task.cron);
    }
  }
  saveSchedules(schedules);
}
