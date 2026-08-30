import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OrdersService } from '../../services/orders.service';
import { Order, ALL_STEPS_CONFIG, StepConfig } from '../../models/order.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
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
  includeSecurit = true;
  includeDouble = true;
  isCreating = false;

  // Toast
  toastMessage = '';
  toastType = 'success';
  showToast = false;

  allSteps = ALL_STEPS_CONFIG;
  private pollTimer: any = null;

  constructor(
    public auth: AuthService,
    private ordersService: OrdersService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders(true);
    // Background real-time polling every 6 seconds to sync across browsers
    this.pollTimer = setInterval(() => {
      this.pollOrders();
    }, 6000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  get isValidStepSelection(): boolean {
    return this.includeSecurit || this.includeDouble;
  }

  loadOrders(showSpinner: boolean = true): void {
    if (showSpinner) this.isLoading = true;
    this.ordersService.fetchAll().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.updateStats();
        this.applyFilter();
        this.isLoading = false;
        this.errorMessage = '';
      },
      error: (err) => {
        this.errorMessage = 'حدث خطأ في تحميل الطلبات';
        this.isLoading = false;
      }
    });
  }

  private pollOrders(): void {
    if (this.isCreating) return;
    this.ordersService.fetchAll().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.updateStats();
        this.applyFilter();
      },
      error: () => {}
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

  getOrderSteps(order: Order): StepConfig[] {
    return this.ordersService.getOrderSteps(order);
  }

  getActiveStepIndex(order: Order): number {
    return this.ordersService.getActiveStepIndex(order);
  }

  getCompletedCount(order: Order): number {
    return this.ordersService.getCompletedCount(order);
  }

  isStepDone(order: Order, stepId: string): boolean {
    return order.steps?.[stepId]?.status === 'done';
  }

  isActiveStep(order: Order, stepIndex: number): boolean {
    const orderSteps = this.getOrderSteps(order);
    const activeIdx = this.getActiveStepIndex(order);
    return stepIndex === activeIdx && stepIndex < orderSteps.length && !this.isStepDone(order, orderSteps[stepIndex].id);
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
    this.includeSecurit = true;
    this.includeDouble = true;
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

    if (!this.isValidStepSelection) {
      this.displayToast('يجب اختيار مرحلة واحدة على الأقل بين السيكوريت والدبل', 'error');
      return;
    }

    const selectedSteps = ['cutting'];
    if (this.includeSecurit) selectedSteps.push('securit');
    if (this.includeDouble) selectedSteps.push('double');
    selectedSteps.push('delivery');

    this.isCreating = true;
    this.ordersService.create({
      orderId: this.newOrderId || undefined,
      customerName: this.newCustomerName.trim(),
      orderDetails: this.newOrderDetails.trim(),
      selectedSteps
    }).subscribe({
      next: (order) => {
        this.closeNewOrderModal();
        this.displayToast(`تم إنشاء الطلب #${order.orderId} بنجاح ✓`, 'success');
        this.loadOrders(false);
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

