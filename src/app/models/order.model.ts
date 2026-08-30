export interface StepData {
  status: 'pending' | 'done';
  completedAt: string | null;
  completedBy: string | null;
}

export interface OrderSteps {
  cutting?: StepData;
  securit?: StepData;
  double?: StepData;
  delivery?: StepData;
  [key: string]: StepData | undefined;
}

export interface Order {
  _id?: string;
  orderId: number;
  customerName?: string;
  orderDetails?: string;
  selectedSteps?: string[];
  steps: OrderSteps;
  createdAt: string;
  updatedAt?: string;
}

export interface StepConfig {
  id: 'cutting' | 'securit' | 'double' | 'delivery';
  stepNumber: number;
  label: string;
  icon: string;
  description: string;
  allowedRole: string;
  allowedRoles?: string[];
  isMandatory?: boolean;
}

export const ALL_STEPS_CONFIG: StepConfig[] = [
  { id: 'cutting', stepNumber: 1, label: 'تقطيع', icon: '✂️', description: 'مرحلة تقطيع الزجاج حسب المقاسات والمواصفات', allowedRole: 'cutter', allowedRoles: ['cutter', 'admin'], isMandatory: true },
  { id: 'securit', stepNumber: 2, label: 'سيكوريت', icon: '🛡️', description: 'مرحلة معالجة السيكوريت والتقسية الحرارية', allowedRole: 'securit', allowedRoles: ['securit', 'welder', 'admin'], isMandatory: false },
  { id: 'double', stepNumber: 3, label: 'دبل', icon: '🪟', description: 'مرحلة تجميع طبقات الزجاج الدبل والعزل', allowedRole: 'double', allowedRoles: ['double', 'finisher', 'admin'], isMandatory: false },
  { id: 'delivery', stepNumber: 4, label: 'تسليم', icon: '🚚', description: 'المرحلة النهائية وفحص وتجهيز التسليم للعميل', allowedRole: 'delivery', allowedRoles: ['delivery', 'admin'], isMandatory: true },
];

export const STEPS_CONFIG = ALL_STEPS_CONFIG;

