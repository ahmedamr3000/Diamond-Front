import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OrdersService } from '../../services/orders.service';
import { Order, STEPS_CONFIG } from '../../models/order.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  currentFilter = 'all';
  searchQuery = '';
  isLoading = true;
  errorMessage = '';

  stats = { total: 0, new: 0, progress: 0, done: 0 };

  // Modal state
  showNewOrderModal = false;
  newOrderId: number | null = null;
  newCustomerName = '';
  newOrderDetails = '';
  isCreating = false;

  // Toast
  toastMessage = '';
  toastType = 'success';
  showToast = false;

  steps = STEPS_CONFIG;

  constructor(
    public auth: AuthService,
    private ordersService: OrdersService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    this.isLoading = true;
    this.ordersService.fetchAll().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.updateStats();
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'حدث خطأ في تحميل الطلبات';
        this.isLoading = false;
      }
    });
  }

  updateStats(): void {
    this.stats = { total: this.orders.length, new: 0, progress: 0, done: 0 };
    this.orders.forEach(o => {
      const s = this.ordersService.getStatus(o);
      if (s === 'new') this.stats.new++;
      else if (s === 'in-progress') this.stats.progress++;
      else if (s === 'completed') this.stats.done++;
    });
  }

  setFilter(filter: string): void {
    this.currentFilter = filter;
    this.applyFilter();
  }

  applyFilter(): void {
    let result = [...this.orders];

    // 1. Status Filter
    if (this.currentFilter !== 'all') {
      result = result.filter(o => this.ordersService.getStatus(o) === this.currentFilter);
    }

    // 2. Multi-field Search Filter: Order ID OR Customer Name OR Order Details
    const query = this.searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(o => {
        const idStr = (o.orderId || '').toString().toLowerCase();
        const custName = (o.customerName || '').toLowerCase();
        const details = (o.orderDetails || '').toLowerCase();

        return idStr.includes(query) || custName.includes(query) || details.includes(query);
      });
    }

    this.filteredOrders = result;
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilter();
  }

  getStatus(order: Order): string {
    return this.ordersService.getStatus(order);
  }

  getActiveStepIndex(order: Order): number {
    return this.ordersService.getActiveStepIndex(order);
  }

  getCompletedCount(order: Order): number {
    return this.ordersService.getCompletedCount(order);
  }

  isStepDone(order: Order, stepIndex: number): boolean {
    const step = STEPS_CONFIG[stepIndex];
    return order.steps?.[step.id]?.status === 'done';
  }

  isActiveStep(order: Order, stepIndex: number): boolean {
    return stepIndex === this.getActiveStepIndex(order) && !this.isStepDone(order, stepIndex);
  }

  getStepStatus(order: Order, stepIndex: number): 'done' | 'active' | 'pending' {
    if (this.isStepDone(order, stepIndex)) return 'done';
    if (this.isActiveStep(order, stepIndex)) return 'active';
    return 'pending';
  }

  getStepperFillPercent(order: Order): number {
    const completed = this.getCompletedCount(order);
    if (completed === 0) return 0;
    if (completed >= this.steps.length) return 100;
    return (completed / (this.steps.length - 1)) * 100;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = { 'new': 'جديد', 'in-progress': 'قيد التنفيذ', 'completed': 'مكتمل' };
    return labels[status] || status;
  }

  getBadgeClass(status: string): string {
    const classes: Record<string, string> = { 'new': 'badge-new', 'in-progress': 'badge-in-progress', 'completed': 'badge-completed' };
    return classes[status] || '';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  openOrder(orderId: number): void {
    this.router.navigate(['/order', orderId]);
  }

  // New Order Modal
  openNewOrderModal(): void {
    this.newCustomerName = '';
    this.newOrderDetails = '';
    this.ordersService.getNextId().subscribe({
      next: (id) => {
        this.newOrderId = id;
        this.showNewOrderModal = true;
      },
      error: () => {
        this.newOrderId = 11001;
        this.showNewOrderModal = true;
      }
    });
  }

  closeNewOrderModal(): void {
    this.showNewOrderModal = false;
    this.isCreating = false;
  }

  confirmCreateOrder(): void {
    if (!this.newCustomerName.trim() || !this.newOrderDetails.trim()) {
      this.displayToast('يرجى كتابة اسم العميل وتفاصيل الطلب', 'error');
      return;
    }

    this.isCreating = true;
    this.ordersService.create({
      orderId: this.newOrderId || undefined,
      customerName: this.newCustomerName.trim(),
      orderDetails: this.newOrderDetails.trim()
    }).subscribe({
      next: (order) => {
        this.closeNewOrderModal();
        this.displayToast(`تم إنشاء الطلب #${order.orderId} بنجاح ✓`, 'success');
        this.loadOrders();
      },
      error: (err) => {
        this.isCreating = false;
        this.displayToast('خطأ في إنشاء الطلب', 'error');
      }
    });
  }

  displayToast(message: string, type: string): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => { this.showToast = false; }, 3200);
  }
}
