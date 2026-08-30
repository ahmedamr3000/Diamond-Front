import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { Order, ALL_STEPS_CONFIG, STEPS_CONFIG, StepConfig } from '../models/order.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

const LOCAL_STORAGE_KEY = 'gw_orders_v3';

function getApiUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://diamond-back-end-wine.vercel.app/api';
  }
  return (environment.apiUrl || 'http://localhost:5000/api').replace(/\/+$/, '');
}

const API_URL = getApiUrl();

@Injectable({
  providedIn: 'root'
})
export class OrdersService {

  constructor(private http: HttpClient, private auth: AuthService) {
    this.initLocalStorage();
  }

  private initLocalStorage(): void {
    if (!localStorage.getItem(LOCAL_STORAGE_KEY)) {
      const initialOrders: Order[] = [
        {
          orderId: 11001,
          customerName: 'هشام الحسيني',
          orderDetails: 'عاكس بني + شفاف',
          createdAt: new Date().toISOString(),
          selectedSteps: ['cutting', 'securit', 'double', 'delivery'],
          steps: {
            cutting: { status: 'pending', completedAt: null, completedBy: null },
            securit: { status: 'pending', completedAt: null, completedBy: null },
            double: { status: 'pending', completedAt: null, completedBy: null },
            delivery: { status: 'pending', completedAt: null, completedBy: null }
          }
        },
        {
          orderId: 11002,
          customerName: 'مكتب النور للمقاولات',
          orderDetails: 'سيكوريت 10 مم شفاف واجهات',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          selectedSteps: ['cutting', 'securit', 'delivery'],
          steps: {
            cutting: { status: 'pending', completedAt: null, completedBy: null },
            securit: { status: 'pending', completedAt: null, completedBy: null },
            delivery: { status: 'pending', completedAt: null, completedBy: null }
          }
        },
        {
          orderId: 11003,
          customerName: 'فيلا المهندس طارق',
          orderDetails: 'دبل 24 مم عاكس رمادي + جورجيا',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          selectedSteps: ['cutting', 'double', 'delivery'],
          steps: {
            cutting: { status: 'pending', completedAt: null, completedBy: null },
            double: { status: 'pending', completedAt: null, completedBy: null },
            delivery: { status: 'pending', completedAt: null, completedBy: null }
          }
        }
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialOrders));
    }
  }

  private getLocalOrders(): Order[] {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private saveLocalOrders(orders: Order[]): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
  }

  normalizeOrder(order: any): Order {
    if (!order) return order;
    const steps = order.steps || {};
    
    // Determine selectedSteps
    let selectedSteps: string[] = order.selectedSteps;
    if (!selectedSteps || !Array.isArray(selectedSteps) || selectedSteps.length === 0) {
      const available: string[] = ['cutting'];
      if (steps.securit || steps.welding) available.push('securit');
      if (steps.double || steps.finishing) available.push('double');
      if (!available.includes('securit') && !available.includes('double')) {
        available.push('securit', 'double');
      }
      available.push('delivery');
      selectedSteps = available;
    }

    const normalizedSteps: Record<string, any> = {};
    selectedSteps.forEach(stepKey => {
      if (steps[stepKey]) {
        normalizedSteps[stepKey] = steps[stepKey];
      } else if (stepKey === 'securit' && steps.welding) {
        normalizedSteps[stepKey] = steps.welding;
      } else if (stepKey === 'double' && steps.finishing) {
        normalizedSteps[stepKey] = steps.finishing;
      } else {
        normalizedSteps[stepKey] = { status: 'pending', completedAt: null, completedBy: null };
      }
    });

    return {
      ...order,
      customerName: order.customerName || 'عميل نقدي',
      orderDetails: order.orderDetails || 'زجاج متنوع',
      selectedSteps,
      steps: normalizedSteps
    };
  }

  getOrderSteps(order: Order | null | undefined): StepConfig[] {
    if (!order) return ALL_STEPS_CONFIG;
    const norm = this.normalizeOrder(order);
    const selected = (norm.selectedSteps && norm.selectedSteps.length > 0)
      ? norm.selectedSteps
      : ['cutting', 'securit', 'double', 'delivery'];

    return selected
      .map(id => ALL_STEPS_CONFIG.find(s => s.id === id))
      .filter((s): s is StepConfig => !!s)
      .map((s, index) => ({
        ...s,
        stepNumber: index + 1
      }));
  }

  fetchAll(): Observable<Order[]> {
    return this.http.get<{ success: boolean; orders: Order[] }>(`${API_URL}/orders`).pipe(
      map(res => (res.orders || []).map(o => this.normalizeOrder(o))),
      catchError((err) => {
        console.warn('Backend fetchAll fallback to local storage:', err);
        return of(this.getLocalOrders().map(o => this.normalizeOrder(o)));
      })
    );
  }

  fetchById(orderId: number): Observable<Order> {
    return this.http.get<{ success: boolean; order: Order }>(`${API_URL}/orders/${orderId}`).pipe(
      map(res => this.normalizeOrder(res.order)),
      catchError((err) => {
        console.warn('Backend fetchById fallback to local storage:', err);
        const found = this.getLocalOrders().find(o => o.orderId === orderId);
        if (found) return of(this.normalizeOrder(found));
        throw new Error('الطلب غير موجود');
      })
    );
  }

  getNextId(): Observable<number> {
    return this.http.get<{ success: boolean; nextId: number }>(`${API_URL}/orders/next/id`).pipe(
      map(res => res.nextId),
      catchError(() => {
        const orders = this.getLocalOrders();
        const maxId = orders.length > 0 ? Math.max(...orders.map(o => o.orderId)) : 11000;
        return of(maxId + 1);
      })
    );
  }

  create(payload: { orderId?: number; customerName: string; orderDetails: string; selectedSteps?: string[] }): Observable<Order> {
    const selectedSteps = payload.selectedSteps || ['cutting', 'securit', 'double', 'delivery'];
    return this.http.post<{ success: boolean; order: Order }>(`${API_URL}/orders`, {
      role: this.auth.currentUser?.role,
      orderId: payload.orderId,
      customerName: payload.customerName,
      orderDetails: payload.orderDetails,
      selectedSteps
    }).pipe(
      map(res => this.normalizeOrder(res.order)),
      catchError((err) => {
        console.warn('Backend create fallback to local storage:', err);
        const orders = this.getLocalOrders();
        const maxId = orders.length > 0 ? Math.max(...orders.map(o => o.orderId)) : 11000;
        const newOrderId = payload.orderId || (maxId + 1);

        const stepsObj: Record<string, any> = {};
        selectedSteps.forEach(stepKey => {
          stepsObj[stepKey] = { status: 'pending', completedAt: null, completedBy: null };
        });

        const newOrder: Order = {
          orderId: newOrderId,
          customerName: payload.customerName || 'عميل نقدي',
          orderDetails: payload.orderDetails || 'زجاج متنوع',
          createdAt: new Date().toISOString(),
          selectedSteps,
          steps: stepsObj
        };
        orders.unshift(newOrder);
        this.saveLocalOrders(orders);
        return of(newOrder);
      })
    );
  }

  completeStep(orderId: number, stepId: string): Observable<Order> {
    return this.http.put<{ success: boolean; order: Order }>(`${API_URL}/orders/${orderId}/steps/${stepId}`, {
      role: this.auth.currentUser?.role,
      displayName: this.auth.currentUser?.displayName
    }).pipe(
      map(res => this.normalizeOrder(res.order)),
      catchError((err) => {
        console.warn('Backend completeStep fallback to local storage:', err);
        const orders = this.getLocalOrders();
        const order = orders.find(o => o.orderId === orderId);
        if (order) {
          if (!order.steps[stepId]) {
            order.steps[stepId] = { status: 'pending', completedAt: null, completedBy: null };
          }
          order.steps[stepId] = {
            status: 'done',
            completedAt: new Date().toISOString(),
            completedBy: this.auth.currentUser?.displayName || 'المستخدم'
          };
          this.saveLocalOrders(orders);
          return of(this.normalizeOrder(order));
        }
        throw new Error('تعذر تحديث المرحلة');
      })
    );
  }

  updateOrder(orderId: number, payload: { customerName?: string; orderDetails?: string }): Observable<Order> {
    return this.http.put<{ success: boolean; order: Order }>(`${API_URL}/orders/${orderId}`, {
      role: this.auth.currentUser?.role,
      customerName: payload.customerName,
      orderDetails: payload.orderDetails
    }).pipe(
      map(res => this.normalizeOrder(res.order)),
      catchError(() => {
        const orders = this.getLocalOrders();
        const order = orders.find(o => o.orderId === orderId);
        if (order) {
          if (payload.customerName !== undefined) order.customerName = payload.customerName;
          if (payload.orderDetails !== undefined) order.orderDetails = payload.orderDetails;
          this.saveLocalOrders(orders);
          return of(this.normalizeOrder(order));
        }
        throw new Error('تعذر تعديل الطلب');
      })
    );
  }

  deleteOrder(orderId: number): Observable<any> {
    return this.http.request('DELETE', `${API_URL}/orders/${orderId}`, {
      body: { role: this.auth.currentUser?.role }
    }).pipe(
      catchError(() => {
        const orders = this.getLocalOrders().filter(o => o.orderId !== orderId);
        this.saveLocalOrders(orders);
        return of({ success: true });
      })
    );
  }

  // Utility methods
  getStatus(order: Order): 'new' | 'in-progress' | 'completed' {
    const norm = this.normalizeOrder(order);
    const orderSteps = this.getOrderSteps(norm);
    const allDone = orderSteps.every(s => norm.steps?.[s.id]?.status === 'done');
    const anyDone = orderSteps.some(s => norm.steps?.[s.id]?.status === 'done');
    if (allDone) return 'completed';
    if (anyDone) return 'in-progress';
    return 'new';
  }

  getActiveStepIndex(order: Order): number {
    const norm = this.normalizeOrder(order);
    const orderSteps = this.getOrderSteps(norm);
    for (let i = 0; i < orderSteps.length; i++) {
      if (norm.steps?.[orderSteps[i].id]?.status !== 'done') return i;
    }
    return orderSteps.length;
  }

  getCompletedCount(order: Order): number {
    const norm = this.normalizeOrder(order);
    const orderSteps = this.getOrderSteps(norm);
    return orderSteps.filter(s => norm.steps?.[s.id]?.status === 'done').length;
  }
}

