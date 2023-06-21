import { Component, ViewChild } from '@angular/core';
import { MatSelectionList, MatSelectionListChange } from '@angular/material/list';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatAccordion, MatExpansionPanel } from '@angular/material/expansion';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'scenario-missing-files';
  files: File[] = [];
  loading = false;
  missings: any[] = [];
  checkReady = false;
  error: string | undefined;
  copiedList: any[] = [];

  expand: any | undefined;

  constructor(private _snackBar: MatSnackBar, private clipboard: Clipboard) { }

  copyToClipboard(text: string): void {
    this.clipboard.copy(text);
    this.showSnakbar('Copied to clipboard!');
  }
  
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/x-zip-compressed' || file.type === 'application/zip') {
        this.uploadFile(file);
      } else {
        console.log('Invalid file type. Please drop a zip file.');
      }
    }
  }

  private uploadFile(file: File) {
    this.loading = true;
    const formData = new FormData();
    formData.append('file', file);

    fetch('http://localhost:8082/upload', {
      method: 'POST',
      body: formData
    })
      .then(response => response.json())
      .then(data => {
        console.log('File uploaded successfully:', data);
        this.missings = data.missing;
        this.loading = false;
        this.checkReady = true;
        // this.readFileContents(data.file);
      })
      .catch(error => {
        console.error('Error uploading file:', error);
        this.loading = false;
        this.checkReady = false;
        this.error = error;
      });
  }

  onSelectionChange(event: MouseEvent, missing: any, expansionPanel: MatExpansionPanel) {
    if (!this.copiedList.some(e => e.path === missing.path)) {
      this.copiedList.push(missing);
    }
    this.copyToClipboard(missing.path);
    event.stopPropagation();
    event.preventDefault();
    event.stopImmediatePropagation();
    expansionPanel.close();
  }

  inCopied(missing: any) {
    return this.copiedList.some(e => e.path === missing.path);
  }

  startOver() {
    this.loading = false;
    this.error = undefined;
    this.missings = [];
    this.copiedList = [];
    this.checkReady = false;
  }

  resetCopy() {
    this.copiedList = [];
  }

  showSnakbar(message: string) {
    this._snackBar.open(message, 'Ok!', { duration: 3000 });
  }

  expandItem(event: MouseEvent, missing: any) {
    this.expand = missing;
    event.stopPropagation();
  }

  contractItem(event: MouseEvent) {
    this.expand = undefined;
    event.stopPropagation();
  }

  isExpanded(missing: any) {
    return this.expand && this.expand.path === missing.path;
  }

}
