import {Component, HostBinding, NgModule} from '@angular/core';
import { CommonModule } from '@angular/common';
import { getCurrentResourceStrings } from '../core/i18n/resources';

@Component({
  selector: 'igx-watermark',
  styleUrls: ['./watermark.component.scss'],
  templateUrl: './watermark.component.html' ,
})
export class IgxWatermarkComponent {
    private resourceStrings = getCurrentResourceStrings();

    @HostBinding('class.igx-watermark')
    public cssClass = 'igx-watermark';

    public textMessage;
    constructor() {
        this.textMessage = this.resourceStrings.igx_grid_watermark_placeholder || 'Trial version of Ignite UI for Angular';
    }
}

@NgModule({
  declarations: [IgxWatermarkComponent],
  exports: [IgxWatermarkComponent],
  imports: [CommonModule],
})

export class IgxWatermarkModule {}


