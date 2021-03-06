import {
    ChangeDetectionStrategy,
    Component,
    HostBinding,
    Input,
    forwardRef,
    OnInit,
    TemplateRef,
    QueryList,
    ContentChild,
    AfterContentInit,
    ViewChild,
    DoCheck
} from '@angular/core';
import { IgxTreeGridAPIService } from './tree-grid-api.service';
import { IgxGridBaseDirective } from '../grid-base.directive';
import { GridBaseAPIService } from '../api.service';
import { ITreeGridRecord } from './tree-grid.interfaces';
import { IRowToggleEventArgs } from '../common/events';
import {
    HierarchicalTransaction,
    HierarchicalState,
    TransactionType,
    TransactionEventOrigin,
    StateUpdateEvent
} from '../../services/transaction/transaction';
import { IgxHierarchicalTransactionService } from '../../services/public_api';
import { IgxFilteringService } from '../filtering/grid-filtering.service';
import { IgxGridSummaryService } from '../summaries/grid-summary.service';
import { IgxGridSelectionService, IgxGridCRUDService } from '../selection/selection.service';
import { mergeObjects } from '../../core/utils';
import { first, takeUntil } from 'rxjs/operators';
import { IgxRowLoadingIndicatorTemplateDirective } from './tree-grid.directives';
import { IgxForOfSyncService, IgxForOfScrollSyncService } from '../../directives/for-of/for_of.sync.service';
import { IgxGridNavigationService } from '../grid-navigation.service';
import { GridType } from '../common/grid.interface';
import { IgxColumnComponent } from '../columns/column.component';
import { IgxRowIslandAPIService } from '../hierarchical-grid/row-island-api.service';
import { IgxTreeGridRowComponent } from './tree-grid-row.component';

let NEXT_ID = 0;

/**
 * **Ignite UI for Angular Tree Grid** -
 * [Documentation](https://www.infragistics.com/products/ignite-ui-angular/angular/components/grid.html)
 *
 * The Ignite UI Tree Grid displays and manipulates hierarchical data with consistent schema formatted as a table and
 * provides features such as sorting, filtering, editing, column pinning, paging, column moving and hiding.
 *
 * Example:
 * ```html
 * <igx-tree-grid [data]="employeeData" primaryKey="employeeID" foreignKey="PID" autoGenerate="false">
 *   <igx-column field="first" header="First Name"></igx-column>
 *   <igx-column field="last" header="Last Name"></igx-column>
 *   <igx-column field="role" header="Role"></igx-column>
 * </igx-tree-grid>
 * ```
 */
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    preserveWhitespaces: false,
    selector: 'igx-tree-grid',
    templateUrl: 'tree-grid.component.html',
    providers: [
        IgxGridSelectionService,
        IgxGridCRUDService,
        IgxGridSummaryService,
        IgxGridNavigationService,
        { provide: GridBaseAPIService, useClass: IgxTreeGridAPIService },
        { provide: IgxGridBaseDirective, useExisting: forwardRef(() => IgxTreeGridComponent) },
        IgxFilteringService,
        IgxForOfSyncService,
        IgxForOfScrollSyncService,
        IgxRowIslandAPIService
    ]
})
export class IgxTreeGridComponent extends IgxGridBaseDirective implements GridType, OnInit, DoCheck, AfterContentInit {
    private _id = `igx-tree-grid-${NEXT_ID++}`;
    private _data;
    private _rowLoadingIndicatorTemplate: TemplateRef<any>;
    protected _transactions: IgxHierarchicalTransactionService<HierarchicalTransaction, HierarchicalState>;

    /**
     * An @Input property that sets the value of the `id` attribute. If not provided it will be automatically generated.
     * ```html
     * <igx-tree-grid [id]="'igx-tree-grid-1'"></igx-tree-grid>
     * ```
     * @memberof IgxTreeGridComponent
     */
    @HostBinding('attr.id')
    @Input()
    public get id(): string {
        return this._id;
    }
    public set id(value: string) {
        this._id = value;
    }

    /**
     * An @Input property that lets you fill the `IgxTreeGridComponent` with an array of data.
     * ```html
     * <igx-tree-grid [data]="Data" [autoGenerate]="true"></igx-tree-grid>
     * ```
     * @memberof IgxTreeGridComponent
     */
    @Input()
    public get data(): any[] {
        return this._data;
    }

    public set data(value: any[]) {
        this._data = value || [];
        this.summaryService.clearSummaryCache();
        if (this.shouldGenerate) {
            this.setupColumns();
        }
        this.cdr.markForCheck();
    }

    /**
     * Returns an array of objects containing the filtered data in the `IgxGridComponent`.
     * ```typescript
     * let filteredData = this.grid.filteredData;
     * ```
     * @memberof IgxTreeGridComponent
     */
    get filteredData() {
        return this._filteredData;
    }

    /**
     * Sets an array of objects containing the filtered data in the `IgxGridComponent`.
     * ```typescript
     * this.grid.filteredData = [{
     *       ID: 1,
     *       Name: "A"
     * }];
     * ```
     * @memberof IgxTreeGridComponent
     */
    set filteredData(value) {
        this._filteredData = value;
    }

    /**
     * Get transactions service for the grid.
     * @experimental @hidden
     */
    get transactions() {
        return this._transactions;
    }

    /**
     * @hidden
     */
    public flatData: any[];

    /**
     * @hidden
     */
    public processedExpandedFlatData: any[];

    /**
     * Returns an array of the root level `ITreeGridRecord`s.
     * ```typescript
     * // gets the root record with index=2
     * const states = this.grid.rootRecords[2];
     * ```
     * @memberof IgxTreeGridComponent
     */
    public rootRecords: ITreeGridRecord[];

    /**
     * Returns a map of all `ITreeGridRecord`s.
     * ```typescript
     * // gets the record with primaryKey=2
     * const states = this.grid.records.get(2);
     * ```
     * @memberof IgxTreeGridComponent
     */
    public records: Map<any, ITreeGridRecord> = new Map<any, ITreeGridRecord>();

    /**
     * Returns an array of processed (filtered and sorted) root `ITreeGridRecord`s.
     * ```typescript
     * // gets the processed root record with index=2
     * const states = this.grid.processedRootRecords[2];
     * ```
     * @memberof IgxTreeGridComponent
     */
    public processedRootRecords: ITreeGridRecord[];

    /**
     * Returns a map of all processed (filtered and sorted) `ITreeGridRecord`s.
     * ```typescript
     * // gets the processed record with primaryKey=2
     * const states = this.grid.processedRecords.get(2);
     * ```
     * @memberof IgxTreeGridComponent
     */
    public processedRecords: Map<any, ITreeGridRecord> = new Map<any, ITreeGridRecord>();

    /**
     * An @Input property that sets the child data key of the `IgxTreeGridComponent`.
     * ```html
     * <igx-tree-grid #grid [data]="employeeData" [childDataKey]="'employees'" [autoGenerate]="true"></igx-tree-grid>
     * ```
     * @memberof IgxTreeGridComponent
     */
    @Input()
    public childDataKey;

    /**
     * An @Input property that sets the foreign key of the `IgxTreeGridComponent`.
     * ```html
     * <igx-tree-grid #grid [data]="employeeData" [primaryKey]="'employeeID'" [foreignKey]="'parentID'" [autoGenerate]="true">
     * </igx-tree-grid>
     * ```
     * @memberof IgxTreeGridComponent
     */
    @Input()
    public foreignKey;

    /**
     * An @Input property that sets the key indicating whether a row has children.
     * This property is only used for load on demand scenarios.
     * ```html
     * <igx-tree-grid #grid [data]="employeeData" [primaryKey]="'employeeID'" [foreignKey]="'parentID'"
     *                [loadChildrenOnDemand]="loadChildren"
     *                [hasChildrenKey]="'hasEmployees'">
     * </igx-tree-grid>
     * ```
     * @memberof IgxTreeGridComponent
     */
    @Input()
    public hasChildrenKey;

    /**
     * An @Input property indicating whether child records should be deleted when their parent gets deleted.
     * By default it is set to true and deletes all children along with the parent.
     * ```html
     * <igx-tree-grid [data]="employeeData" [primaryKey]="'employeeID'" [foreignKey]="'parentID'" cascadeOnDelete="false">
     * </igx-tree-grid>
     * ```
     * @memberof IgxTreeGridComponent
     */
    @Input()
    public cascadeOnDelete = true;

    private _expansionDepth = Infinity;

    /**
     * An @Input property that sets the count of levels to be expanded in the `IgxTreeGridComponent`. By default it is
     * set to `Infinity` which means all levels would be expanded.
     * ```html
     * <igx-tree-grid #grid [data]="employeeData" [childDataKey]="'employees'" expansionDepth="1" [autoGenerate]="true"></igx-tree-grid>
     * ```
     * @memberof IgxTreeGridComponent
     */
    @Input()
    public get expansionDepth(): number {
        return this._expansionDepth;
    }

    public set expansionDepth(value: number) {
        this._expansionDepth = value;
        this.notifyChanges();
    }

    /**
     * @hidden
     */
    @ContentChild(IgxRowLoadingIndicatorTemplateDirective, { read: IgxRowLoadingIndicatorTemplateDirective })
    protected rowLoadingTemplate: IgxRowLoadingIndicatorTemplateDirective;

    /**
     * An @Input property that provides a template for the row loading indicator when load on demand is enabled.
     * ```html
     * <ng-template #rowLoadingTemplate>
     *     <igx-icon fontSet="material">loop</igx-icon>
     * </ng-template>
     *
     * <igx-tree-grid #grid [data]="employeeData" [primaryKey]="'ID'" [foreignKey]="'parentID'"
     *                [loadChildrenOnDemand]="loadChildren"
     *                [rowLoadingIndicatorTemplate]="rowLoadingTemplate">
     * </igx-tree-grid>
     * ```
     * @memberof IgxTreeGridComponent
     */
    @Input()
    public get rowLoadingIndicatorTemplate(): TemplateRef<any> {
        return this._rowLoadingIndicatorTemplate;
    }

    public set rowLoadingIndicatorTemplate(value: TemplateRef<any>) {
        this._rowLoadingIndicatorTemplate = value;
        this.notifyChanges();
    }

    /**
     * An @Input property that provides a callback for loading child rows on demand.
     * ```html
     * <igx-tree-grid [data]="employeeData" [primaryKey]="'employeeID'" [foreignKey]="'parentID'" [loadChildrenOnDemand]="loadChildren">
     * </igx-tree-grid>
     * ```
     * ```typescript
     * public loadChildren = (parentID: any, done: (children: any[]) => void) => {
     *     this.dataService.getData(parentID, children => done(children));
     * }
     * ```
     * @memberof IgxTreeGridComponent
     */
    @Input()
    public loadChildrenOnDemand: (parentID: any, done: (children: any[]) => void) => void;

    /**
     * @hidden
     */
    public loadingRows = new Set<any>();

    // Kind of stupid
    private get _gridAPI(): IgxTreeGridAPIService {
        return this.gridAPI as IgxTreeGridAPIService;
    }
    private _filteredData = null;

    /**
     * @hidden
     * @internal
     */
    @ViewChild('dragIndicatorIconBase', { read: TemplateRef, static: true })
    public dragIndicatorIconBase: TemplateRef<any>;

    /**
     * @hidden @internal
     */
    @ViewChild('record_template', { read: TemplateRef, static: true })
    protected recordTemplate: TemplateRef<any>;

    /**
     * @hidden @internal
     */
    @ViewChild('summary_template', { read: TemplateRef, static: true })
    protected summaryTemplate: TemplateRef<any>;

    /**
     * @hidden
     */
    public ngOnInit() {
        super.ngOnInit();

        this.onRowToggle.pipe(takeUntil(this.destroy$)).subscribe((args) => {
            this.loadChildrenOnRowExpansion(args);
        });

        this.transactions.onStateUpdate.pipe(takeUntil<any>(this.destroy$)).subscribe((event: StateUpdateEvent) => {
            let actions = [];
            if (event.origin === TransactionEventOrigin.REDO) {
                actions = event.actions ? event.actions.filter(x => x.transaction.type === TransactionType.DELETE) : [];
            } else if (event.origin === TransactionEventOrigin.UNDO) {
                actions = event.actions ? event.actions.filter(x => x.transaction.type === TransactionType.ADD) : [];
            }
            if (actions.length) {
                for (const action of actions) {
                    this.deselectChildren(action.transaction.id);
                }
            }
        });
    }

    ngDoCheck() {
        super.ngDoCheck();
    }

    /**
     * @hidden
     */
    public ngAfterContentInit() {
        if (this.rowLoadingTemplate) {
            this._rowLoadingIndicatorTemplate = this.rowLoadingTemplate.template;
        }
        super.ngAfterContentInit();
    }

    private loadChildrenOnRowExpansion(args: IRowToggleEventArgs) {
        if (this.loadChildrenOnDemand) {
            const parentID = args.rowID;

            if (args.expanded && !this._expansionStates.has(parentID)) {
                this.loadingRows.add(parentID);

                this.loadChildrenOnDemand(parentID, children => {
                    this.loadingRows.delete(parentID);
                    this.addChildRows(children, parentID);
                    this.notifyChanges();
                });
            }
        }
    }

    private addChildRows(children: any[], parentID: any) {
        if (this.primaryKey && this.foreignKey) {
            for (const child of children) {
                child[this.foreignKey] = parentID;
            }
            this.data.push(...children);
        } else if (this.childDataKey) {
            let parent = this.records.get(parentID);
            let parentData = parent.data;

            if (this.transactions.enabled && this.transactions.getAggregatedChanges(true).length) {
                const path = [];
                while (parent) {
                    path.push(parent.rowID);
                    parent = parent.parent;
                }

                let collection = this.data;
                let record: any;
                for (let i = path.length - 1; i >= 0; i--) {
                    const pid = path[i];
                    record = collection.find(r => r[this.primaryKey] === pid);

                    if (!record) {
                        break;
                    }
                    collection = record[this.childDataKey];
                }
                if (record) {
                    parentData = record;
                }
            }

            parentData[this.childDataKey] = children;
        }
        this.selectionService.clearHeaderCBState();
        this._pipeTrigger++;
    }

    private cloneMap(mapIn: Map<any, boolean>): Map<any, boolean> {
        const mapCloned: Map<any, boolean> = new Map<any, boolean>();

        mapIn.forEach((value: boolean, key: any, mapObj: Map<any, boolean>) => {

            mapCloned.set(key, value);
        });

        return mapCloned;
    }

    public getDefaultExpandState(record: ITreeGridRecord) {
        return record.children && record.children.length && record.level < this.expansionDepth;
    }

    /**
     * Expands all rows.
     * ```typescript
     * this.grid.expandAll();
     * ```
     * @memberof IgxTreeGridComponent
     */
    public expandAll() {
        this._expansionDepth = Infinity;
        this.expansionStates = new Map<any, boolean>();
    }

    /**
     * Collapses all rows.
     *
     * ```typescript
     * this.grid.collapseAll();
     *  ```
     * @memberof IgxTreeGridComponent
     */
    public collapseAll() {
        this._expansionDepth = 0;
        this.expansionStates = new Map<any, boolean>();
    }

    /**
     * Creates a new `IgxTreeGridRowComponent` with the given data. If a parentRowID is not specified, the newly created
     * row would be added at the root level. Otherwise, it would be added as a child of the row whose primaryKey matches
     * the specified parentRowID. If the parentRowID does not exist, an error would be thrown.
     * ```typescript
     * const record = {
     *     ID: this.grid.data[this.grid1.data.length - 1].ID + 1,
     *     Name: this.newRecord
     * };
     * this.grid.addRow(record, 1); // Adds a new child row to the row with ID=1.
     * ```
     * @param data
     * @param parentRowID
     * @memberof IgxTreeGridComponent
     */
    public addRow(data: any, parentRowID?: any) {
        if (parentRowID !== undefined && parentRowID !== null) {
            super.endEdit(true);

            const state = this.transactions.getState(parentRowID);
            // we should not allow adding of rows as child of deleted row
            if (state && state.type === TransactionType.DELETE) {
                throw Error(`Cannot add child row to deleted parent row`);
            }

            const parentRecord = this.records.get(parentRowID);

            if (!parentRecord) {
                throw Error('Invalid parent row ID!');
            }
            this.summaryService.clearSummaryCache({rowID: parentRecord.rowID});
            if (this.primaryKey && this.foreignKey) {
                data[this.foreignKey] = parentRowID;
                super.addRow(data);
            } else {
                const parentData = parentRecord.data;
                const childKey = this.childDataKey;
                if (this.transactions.enabled) {
                    const rowId = this.primaryKey ? data[this.primaryKey] : data;
                    const path: any[] = [];
                    path.push(...this.generateRowPath(parentRowID));
                    path.push(parentRowID);
                    this.transactions.add({
                        id: rowId,
                        path: path,
                        newValue: data,
                        type: TransactionType.ADD
                    } as HierarchicalTransaction,
                        null);
                } else {
                    if (!parentData[childKey]) {
                        parentData[childKey] = [];
                    }
                    parentData[childKey].push(data);
                }
                this.onRowAdded.emit({ data });
                this._pipeTrigger++;
                this.notifyChanges();
            }
        } else {
            if (this.primaryKey && this.foreignKey) {
                const rowID = data[this.foreignKey];
                this.summaryService.clearSummaryCache({rowID: rowID});
            }
            super.addRow(data);
        }
    }

    /** @hidden */
    public deleteRowById(rowId: any) {
        //  if this is flat self-referencing data, and CascadeOnDelete is set to true
        //  and if we have transactions we should start pending transaction. This allows
        //  us in case of delete action to delete all child rows as single undo action
        this._gridAPI.deleteRowById(rowId);

    }

    /** @hidden */
    public generateRowPath(rowId: any): any[] {
        const path: any[] = [];
        let record = this.records.get(rowId);

        while (record.parent) {
            path.push(record.parent.rowID);
            record = record.parent;
        }

        return path.reverse();
    }

    /**
     * @hidden @internal
     */
    protected getDataBasedBodyHeight(): number {
        return !this.flatData || (this.flatData.length < this._defaultTargetRecordNumber) ?
            0 : this.defaultTargetBodyHeight;
    }

    /**
     * @hidden
     */
    protected scrollTo(row: any | number, column: any | number): void {
        let delayScrolling = false;
        let record: ITreeGridRecord;

        if (typeof(row) !== 'number') {
            const rowData = row;
            const rowID = this._gridAPI.get_row_id(rowData);
            record = this.processedRecords.get(rowID);
            this._gridAPI.expand_path_to_record(record);

            if (this.paging) {
                const rowIndex = this.processedExpandedFlatData.indexOf(rowData);
                const page = Math.floor(rowIndex / this.perPage);

                if (this.page !== page) {
                    delayScrolling = true;
                    this.page = page;
                }
            }
        }

        if (delayScrolling) {
            this.verticalScrollContainer.onDataChanged.pipe(first()).subscribe(() => {
                this.scrollDirective(this.verticalScrollContainer,
                    typeof(row) === 'number' ? row : this.unpinnedDataView.indexOf(record));
            });
        } else {
            this.scrollDirective(this.verticalScrollContainer,
                typeof(row) === 'number' ? row : this.unpinnedDataView.indexOf(record));
        }

        this.scrollToHorizontally(column);
    }

    /**
     * @hidden
     */
    public getContext(rowData: any, rowIndex: number, pinned?: boolean): any {
        return {
            $implicit: this.isGhostRecord(rowData) ? rowData.recordRef : rowData,
            index: this.getDataViewIndex(rowIndex, pinned),
            templateID: this.isSummaryRow(rowData) ? 'summaryRow' : 'dataRow',
            disabled: this.isGhostRecord(rowData) ? rowData.recordRef.isFilteredOutParent === undefined : false
        };
    }

    /**
     * @hidden
     * @internal
     */
    public getInitialPinnedIndex(rec) {
        return this._pinnedRecordIDs.indexOf(rec.rowID);
    }

    /**
     * @inheritdoc
     */
    getSelectedData(formatters = false, headers = false): any[] {
        let source = [];

        const process = (record) => {
            if (record.summaries) {
                source.push(null);
                return;
            }
            source.push(record.data);
        };

        this.unpinnedDataView.forEach(process);
        source = this.isRowPinningToTop ? [...this.pinnedDataView, ...source] : [...source, ...this.pinnedDataView];
        return this.extractDataFromSelection(source, formatters, headers);
    }

    /**
     * @hidden
     */
    public get template(): TemplateRef<any> {
        if (this.filteredData && this.filteredData.length === 0) {
            return this.emptyGridTemplate ? this.emptyGridTemplate : this.emptyFilteredGridTemplate;
        }

        if (this.isLoading && (!this.data || this.dataLength === 0)) {
            return this.loadingGridTemplate ? this.loadingGridTemplate : this.loadingGridDefaultTemplate;
        }

        if (this.dataLength === 0) {
            return this.emptyGridTemplate ? this.emptyGridTemplate : this.emptyGridDefaultTemplate;
        }
    }

    protected writeToData(rowIndex: number, value: any) {
        mergeObjects(this.flatData[rowIndex], value);
    }

    /**
     * @hidden
     */
   protected initColumns(collection: QueryList<IgxColumnComponent>, cb: Function = null) {
        if (this.hasColumnLayouts) {
            // invalid configuration - tree grid should not allow column layouts
            // remove column layouts
            const nonColumnLayoutColumns = this.columnList.filter((col) => !col.columnLayout && !col.columnLayoutChild);
            this.columnList.reset(nonColumnLayoutColumns);
        }
        super.initColumns(collection, cb);
    }

    /**
     * @description A recursive way to deselect all selected children of a given record
     * @param recordID ID of the record whose children to deselect
     * @hidden
     * @internal
     */
    private deselectChildren(recordID): void {
        const selectedChildren = [];
        const rowToDeselect = (this.getRowByKey(recordID) as IgxTreeGridRowComponent).treeRow;
        this.selectionService.deselectRow(recordID);
        this._gridAPI.get_selected_children(rowToDeselect, selectedChildren);
        if (selectedChildren.length > 0) {
            selectedChildren.forEach(x => this.deselectChildren(x));
        }
    }
}
