import { ComponentRef, Injectable, TemplateRef, EventEmitter } from '@angular/core';

import { ComponentLoader } from '../utils/component-loader';
import { ComponentLoaderFactory } from '../utils/component-loader';
import { ModalBackdropComponent } from './modalBackdropComponent';
import { ModalContainerComponent } from './modalContainerComponent';
import { BsModalRef, ClassName, modalConfigDefaults, ModalOptions, TransitionDurations } from './modalOptionsClass';

@Injectable()
export class BsModalService {
  // constructor props
  public config: ModalOptions = modalConfigDefaults;

  public onShow: EventEmitter<any> = new EventEmitter();
  public onShown: EventEmitter<any> = new EventEmitter();
  public onHide: EventEmitter<any> = new EventEmitter();
  public onHidden: EventEmitter<any> = new EventEmitter();

  protected isBodyOverflowing = false;
  protected originalBodyPadding = 0;

  protected scrollbarWidth = 0;

  protected backdropRef: ComponentRef<ModalBackdropComponent>;
  private _backdropLoader: ComponentLoader<ModalBackdropComponent>;
  private modalsCount = 0;
  private lastDismissReason = '';

  private loaders: ComponentLoader<ModalContainerComponent>[] = [];

  public constructor(private clf: ComponentLoaderFactory) {
    this._backdropLoader = this.clf.createLoader<ModalBackdropComponent>(null, null, null);
  }

  /** Shows a modal */
  show(content: string | TemplateRef<any> | any, config?: any): BsModalRef {
    this.modalsCount++;
    this._createLoaders();
    this.config = Object.assign({}, modalConfigDefaults, config);
    this._showBackdrop();
    this.lastDismissReason = null;
    return this._showModal(content);
  }

  hide(level: number) {
    if (this.modalsCount === 1) {
      this._hideBackdrop();
      this.resetScrollbar();
    }
    this.modalsCount = this.modalsCount >= 1 ? this.modalsCount - 1 : 0;
    setTimeout(() => {
      this._hideModal(level);
      this.removeLoaders(level);
    }, this.config.animated ? TransitionDurations.BACKDROP : 0);
  }

  _showBackdrop(): void {
    const isBackdropEnabled = this.config.backdrop || this.config.backdrop === 'static';
    const isBackdropInDOM = !this.backdropRef || !this.backdropRef.instance.isShown;

    if (this.modalsCount === 1) {
      this.removeBackdrop();

      if (isBackdropEnabled && isBackdropInDOM) {
        this._backdropLoader
          .attach(ModalBackdropComponent)
          .to('body')
          .show({isAnimated: this.config.animated});
        this.backdropRef = this._backdropLoader._componentRef;
      }
    }
  }

  _hideBackdrop(): void {
    if (!this.backdropRef) {
      return;
    }
    this.backdropRef.instance.isShown = false;
    const duration = this.config.animated ? TransitionDurations.BACKDROP : 0;
    setTimeout(() => this.removeBackdrop(), duration);
  }

  _showModal(content: any): BsModalRef {
    const modalLoader = this.loaders[this.loaders.length - 1];
    const bsModalRef = new BsModalRef();
    const modalContainerRef = modalLoader
      .provide({provide: ModalOptions, useValue: this.config})
      .provide({provide: BsModalRef, useValue: bsModalRef})
      .attach(ModalContainerComponent)
      .to('body')
      .show({content, isAnimated: this.config.animated});
    modalContainerRef.instance.level = this.getModalsCount();
    bsModalRef.hide = () => {
      modalContainerRef.instance.hide();
    };
    bsModalRef.content = modalLoader.getInnerComponent() || null;
    return bsModalRef;
  }

  _hideModal(level: number): void {
    const modalLoader = this.loaders[level - 1];
    if (modalLoader) {
      modalLoader.hide();
    }
  }

  getModalsCount(): number {
    return this.modalsCount;
  }

  setDismissReason(reason: string) {
    this.lastDismissReason = reason;
  }

  protected removeBackdrop(): void {
    this._backdropLoader.hide();
    this.backdropRef = null;
  }

  /** AFTER PR MERGE MODAL.COMPONENT WILL BE USING THIS CODE*/
  /** Scroll bar tricks */
  /** @internal */
  public checkScrollbar(): void {
    this.isBodyOverflowing = document.body.clientWidth < window.innerWidth;
    this.scrollbarWidth = this.getScrollbarWidth();
  }

  public setScrollbar(): void {
    if (!document) {
      return;
    }

    this.originalBodyPadding = parseInt(window.getComputedStyle(document.body).getPropertyValue('padding-right') || '0', 10);

    if (this.isBodyOverflowing) {
      document.body.style.paddingRight = `${this.originalBodyPadding + this.scrollbarWidth}px`;
    }
  }

  private resetScrollbar(): void {
    document.body.style.paddingRight = this.originalBodyPadding + 'px';
  }

  // thx d.walsh
  private getScrollbarWidth(): number {
    const scrollDiv = document.createElement('div');
    scrollDiv.className = ClassName.SCROLLBAR_MEASURER;
    document.body.appendChild(scrollDiv);
    const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
    document.body.removeChild(scrollDiv);
    return scrollbarWidth;

  }

  private _createLoaders(): void {
    const loader = this.clf.createLoader<ModalContainerComponent>(null, null, null);
    this.copyEvent(loader.onBeforeShow, this.onShow);
    this.copyEvent(loader.onShown, this.onShown);
    this.copyEvent(loader.onBeforeHide, this.onHide);
    this.copyEvent(loader.onHidden, this.onHidden);
    this.loaders.push(loader);
  }

  private removeLoaders(level: number): void {
    this.loaders.splice(level - 1, 1);
    this.loaders.forEach((loader: ComponentLoader<ModalContainerComponent>, i: number) => {
      loader.instance.level = i + 1;
    });
  }

  private copyEvent(from: EventEmitter<any>, to: EventEmitter<any>) {
    from.subscribe(() => {
      to.emit(this.lastDismissReason);
    });
  }
}