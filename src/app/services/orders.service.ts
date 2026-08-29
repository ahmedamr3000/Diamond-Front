import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { Order, STEPS_CONFIG } from '../models/order.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

const LOCAL_STORAGE_KEY = 'gw_orders_v3';

const API_URL = environment.apiUrl;

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
          steps: {
            cutting: { status: 'pending', completedAt: null, completedBy: null },
            securit: { status: 'pending', completedAt: null, completedBy: null },
            double: { status: 'pending', completedAt: null, completedBy: null },
            delivery: { status: 'pending', completedAt: null, completedBy: null }
          }
        },
        {
          orderId: 11003,
          customerName: 'فيلا المهندس طارق',
          orderDetails: 'دبل 24 مم عاكس رمادي + جورجيا',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          steps: {
            cutting: { status: 'pending', completedAt: null, completedBy: null },
            securit: { status: 'pending', completedAt: null, completedBy: null },
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
    return {
      ...order,
      customerName: order.customerName || 'عميل نقدي',
      orderDetails: order.orderDetails || 'زجاج متنوع',
      steps: {
        cutting: steps.cutting || { status: 'pending', completedAt: null, completedBy: null },
        securit: steps.securit || steps.welding || { status: 'pending', completedAt: null, completedBy: null },
        double: steps.double || steps.finishing || { status: 'pending', completedAt: null, completedBy: null },
        delivery: steps.delivery || { status: 'pending', completedAt: null, completedBy: null },
      }
    };
  }

  fetchAll(): Observable<Order[]> {
    return this.http.get<{ success: boolean; orders: Order[] }>(`${API_URL}/orders`).pipe(
      map(res => (res.orders || []).map(o => this.normalizeOrder(o))),
      catchError(() => of(this.getLocalOrders().map(o => this.normalizeOrder(o))))
    );
  }

  fetchById(orderId: number): Observable<Order> {
    return this.http.get<{ success: boolean; order: Order }>(`${API_URL}/orders/${orderId}`).pipe(
      map(res => this.normalizeOrder(res.order)),
      catchError(() => {
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

  create(payload: { orderId?: number; customerName: string; orderDetails: string }): Observable<Order> {
    return this.http.post<{ success: boolean; order: Order }>(`${API_URL}/orders`, {
      role: this.auth.currentUser?.role,
      orderId: payload.orderId,
      customerName: payload.customerName,
      orderDetails: payload.orderDetails
    }).pipe(
      map(res => this.normalizeOrder(res.order)),
      catchError(() => {
        const orders = this.getLocalOrders();
        const maxId = orders.length > 0 ? Math.max(...orders.map(o => o.orderId)) : 11000;
        const newOrderId = payload.orderId || (maxId + 1);
        const newOrder: Order = {
          orderId: newOrderId,
          customerName: payload.customerName || 'عميل نقدي',
          orderDetails: payload.orderDetails || 'زجاج متنوع',
          createdAt: new Date().toISOString(),
          steps: {
            cutting: { status: 'pending', completedAt: null, completedBy: null },
            securit: { status: 'pending', completedAt: null, completedBy: null },
            double: { status: 'pending', completedAt: null, completedBy: null },
            delivery: { status: 'pending', completedAt: null, completedBy: null }
          }
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
      catchError(() => {
        const orders = this.getLocalOrders();
        const order = orders.find(o => o.orderId === orderId);
        if (order && order.steps[stepId as keyof typeof order.steps]) {
          order.steps[stepId as keyof typeof order.steps] = {
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
    const stepIds = STEPS_CONFIG.map(s => s.id);
    const allDone = stepIds.every(id => norm.steps?.[id]?.status === 'done');
    const anyDone = stepIds.some(id => norm.steps?.[id]?.status === 'done');
    if (allDone) return 'completed';
    if (anyDone) return 'in-progress';
    return 'new';
  }

  getActiveStepIndex(order: Order): number {
    const norm = this.normalizeOrder(order);
    for (let i = 0; i < STEPS_CONFIG.length; i++) {
      if (norm.steps?.[STEPS_CONFIG[i].id]?.status !== 'done') return i;
    }
    return STEPS_CONFIG.length;
  }

  getCompletedCount(order: Order): number {
    const norm = this.normalizeOrder(order);
    return STEPS_CONFIG.filter(s => norm.steps?.[s.id]?.status === 'done').length;
  }
}

