import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OrdersService } from '../../services/orders.service';
import { Order, ALL_STEPS_CONFIG, StepConfig } from '../../models/order.model';
import { ROLES_META } from '../../models/user.model';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.css'
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  order: Order | null = null;
  isLoading = true;
  selectedStepIndex = 0;

  // Edit Order Modal
  showEditModal = false;
  editCustomerName = '';
  editOrderDetails = '';
  isUpdating = false;

  // Confirm modal
  showConfirmModal = false;
  confirmIcon = '';
  confirmText = '';
  confirmLabel = '';
  confirmIsDanger = false;
  confirmAction: (() => void) | null = null;

  // Toast
  toastMessage = '';
  toastType = 'success';
  showToast = false;

  // Button loading states
  loadingStepId: string | null = null;
  private pollTimer: any = null;

  constructor(
    public auth: AuthService,
    private ordersService: OrdersService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadOrder(id, true);

    // Background polling every 6 seconds to sync across browsers
    this.pollTimer = setInterval(() => {
      if (this.order && !this.loadingStepId && !this.isUpdating) {
        this.loadOrder(this.order.orderId, false);
      }
    }, 6000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  get steps(): StepConfig[] {
    return this.ordersService.getOrderSteps(this.order);
  }

  loadOrder(orderId: number, showSpinner: boolean = true): void {
    if (showSpinner) this.isLoading = true;
    this.ordersService.fetchById(orderId).subscribe({
      next: (order) => {
        this.order = order;
        this.isLoading = false;
        // Auto-select the active step (or last step if all done) on initial load
        if (showSpinner) {
          const activeIdx = this.getActiveStepIndex();
          this.selectedStepIndex = activeIdx < this.steps.length ? activeIdx : Math.max(0, this.steps.length - 1);
        } else {
          // Clamp selectedStepIndex if steps changed
          if (this.selectedStepIndex >= this.steps.length) {
            this.selectedStepIndex = Math.max(0, this.steps.length - 1);
          }
        }
      },
      error: () => {
        if (showSpinner) {
          this.displayToast('خطأ في تحميل الطلب', 'error');
          this.router.navigate(['/dashboard']);
        }
      }
    });
  }

  selectStep(idx: number): void {
    if (idx >= 0 && idx < this.steps.length) {
      this.selectedStepIndex = idx;
    }
  }

  get currentSelectedStep(): StepConfig {
    return this.steps[this.selectedStepIndex] || this.steps[0] || ALL_STEPS_CONFIG[0];
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  getStatus(): string {
    if (!this.order) return 'new';
    return this.ordersService.getStatus(this.order);
  }

  getStatusLabel(): string {
    const labels: Record<string, string> = { 'new': 'جديد', 'in-progress': 'قيد التنفيذ', 'completed': 'مكتمل' };
    return labels[this.getStatus()] || '';
  }

  getBadgeClass(): string {
    const classes: Record<string, string> = { 'new': 'badge-new', 'in-progress': 'badge-in-progress', 'completed': 'badge-completed' };
    return classes[this.getStatus()] || '';
  }

  getActiveStepIndex(): number {
    if (!this.order) return 0;
    return this.ordersService.getActiveStepIndex(this.order);
  }

  getCompletedCount(): number {
    if (!this.order) return 0;
    return this.ordersService.getCompletedCount(this.order);
  }

  getFillPercent(): number {
    const completed = this.getCompletedCount();
    if (completed === 0 || this.steps.length === 0) return 0;
    return (completed / this.steps.length) * 100;
  }

  getStepperFillPercent(): number {
    const completed = this.getCompletedCount();
    if (completed === 0 || this.steps.length <= 1) return 0;
    if (completed >= this.steps.length) return 100;
    return (completed / (this.steps.length - 1)) * 100;
  }

  getStepClass(idx: number): string {
    if (!this.order || idx >= this.steps.length) return 'pending';
    const step = this.steps[idx];
    const activeIdx = this.getActiveStepIndex();
    if (this.order.steps?.[step.id]?.status === 'done') return 'completed';
    if (idx === activeIdx) return 'active';
    return 'pending';
  }

  getStepStatusText(idx: number): string {
    if (!this.order || idx >= this.steps.length) return 'في الانتظار';
    const step = this.steps[idx];
    const activeIdx = this.getActiveStepIndex();
    if (this.order.steps?.[step.id]?.status === 'done') return 'مكتمل ✓';
    if (idx === activeIdx) return 'المرحلة الحالية';
    return 'في الانتظار';
  }

  getStepStatusClass(idx: number): string {
    if (!this.order || idx >= this.steps.length) return 'pending';
    const step = this.steps[idx];
    const activeIdx = this.getActiveStepIndex();
    if (this.order.steps?.[step.id]?.status === 'done') return 'done';
    if (idx === activeIdx) return 'in-progress';
    return 'pending';
  }

  isStepDone(stepId: string): boolean {
    return this.order?.steps?.[stepId]?.status === 'done';
  }

  isActiveStep(idx: number): boolean {
    return idx === this.getActiveStepIndex();
  }

  canComplete(stepId: string): boolean {
    return this.auth.canCompleteStep(stepId);
  }

  getCompletedDate(stepId: string): string {
    if (!this.order) return '';
    const stepData = this.order.steps?.[stepId];
    if (!stepData?.completedAt) return '';
    const d = new Date(stepData.completedAt);
    const dateStr = d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  }

  getCompletedBy(stepId: string): string {
    if (!this.order) return '';
    return this.order.steps?.[stepId]?.completedBy || '';
  }

  getAllowedRoleLabel(stepId: string): string {
    const step = ALL_STEPS_CONFIG.find(s => s.id === stepId);
    if (!step) return '';
    const roleMeta = ROLES_META.find(r => r.role === step.allowedRole);
    return roleMeta?.roleLabel || '';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  // Step completion
  onCompleteStep(step: StepConfig): void {
    this.confirmIcon = '✅';
    this.confirmText = `هل تريد تأكيد إتمام مرحلة "${step.label}"؟`;
    this.confirmLabel = 'تأكيد الإتمام';
    this.confirmIsDanger = false;
    this.confirmAction = () => {
      this.loadingStepId = step.id;
      this.ordersService.completeStep(this.order!.orderId, step.id).subscribe({
        next: (updatedOrder) => {
          this.order = updatedOrder;
          this.loadingStepId = null;
          this.displayToast(`تم إتمام مرحلة "${step.label}" بنجاح ✓`, 'success');
          if (this.selectedStepIndex < this.steps.length - 1) {
            this.selectedStepIndex++;
          }
        },
        error: (err) => {
          this.loadingStepId = null;
          this.displayToast('خطأ: ' + (err.error?.message || 'حدث خطأ في تحديث المرحلة'), 'error');
        }
      });
    };
    this.showConfirmModal = true;
  }

  // Edit order modal
  openEditModal(): void {
    if (!this.order) return;
    this.editCustomerName = this.order.customerName || '';
    this.editOrderDetails = this.order.orderDetails || '';
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.isUpdating = false;
  }

  confirmUpdateOrder(): void {
    if (!this.order) return;
    if (!this.editCustomerName.trim() || !this.editOrderDetails.trim()) {
      this.displayToast('يرجى كتابة اسم العميل وتفاصيل الطلب', 'error');
      return;
    }

    this.isUpdating = true;
    this.ordersService.updateOrder(this.order.orderId, {
      customerName: this.editCustomerName.trim(),
      orderDetails: this.editOrderDetails.trim()
    }).subscribe({
      next: (updatedOrder) => {
        this.order = updatedOrder;
        this.closeEditModal();
        this.displayToast('تم تعديل بيانات الطلب بنجاح ✓', 'success');
      },
      error: () => {
        this.isUpdating = false;
        this.displayToast('خطأ في تعديل بيانات الطلب', 'error');
      }
    });
  }

  // Delete order
  onDeleteOrder(): void {
    if (!this.order) return;
    this.confirmIcon = '🗑️';
    this.confirmText = `هل أنت متأكد من حذف الطلب #${this.order.orderId}؟ لا يمكن التراجع عن هذا الإجراء.`;
    this.confirmLabel = 'حذف الطلب';
    this.confirmIsDanger = true;
    this.confirmAction = () => {
      this.ordersService.deleteOrder(this.order!.orderId).subscribe({
        next: () => {
          this.displayToast(`تم حذف الطلب #${this.order!.orderId}`, 'success');
          this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.displayToast('خطأ في حذف الطلب', 'error');
        }
      });
    };
    this.showConfirmModal = true;
  }

  // Confirm modal
  executeConfirm(): void {
    this.showConfirmModal = false;
    if (this.confirmAction) this.confirmAction();
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmAction = null;
  }

  displayToast(message: string, type: string): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => { this.showToast = false; }, 3200);
  }
}

