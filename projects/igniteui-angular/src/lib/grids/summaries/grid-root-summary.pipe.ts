import { Pipe, PipeTransform } from '@angular/core';
import { GridBaseAPIService } from '../api.service';
import { IgxGridBaseComponent } from '../grid-base.component';
import { IGridDataBindable } from '../common/events';

@Pipe({
    name: 'igxGridSummaryDataPipe',
    pure: true
})
export class IgxSummaryDataPipe implements PipeTransform {

    constructor(private gridAPI: GridBaseAPIService<IgxGridBaseComponent & IGridDataBindable>) { }

    transform(id: string, trigger: number = 0) {
        const summaryService = this.gridAPI.grid.summaryService;
        return summaryService.calculateSummaries(
            summaryService.rootSummaryID,
            this.gridAPI.get_summary_data()
        );
    }
}
