/*!
 * qpx - qpTreeView
 * Stromová struktura inspirovaná DevExtreme dxTreeView.
 *  - items: [{ id, parentId, text, icon, expanded, selected, disabled }]
 *  - selectionMode: "single" | "multiple"
 *  - expandEvent: "click" | "dblclick"
 *  - showCheckBoxesMode: "none" | "normal" | "selectAll"
 *  - dragEnabled: true/false (drag & drop mezi uzly)
 *  - cascadeCheck: true/false (parent → children)
 *  - useIndeterminate: true/false (partial selection)
 *  - události: onItemClick, onSelectionChanged, onItemExpanded, onItemCollapsed,
 *              onOptionChanged, onDragStart, onDragEnter, onDragLeave,
 *              onDragOver, onDrop, onReorder, onMove
 */

(function (qpx, $) {
    "use strict";

    var TreeView = qpx.Widget.extend({

        defaults: {
            items: [],
            keyExpr: "id",
            parentIdExpr: "parentId",
            displayExpr: "text",
            selectionMode: "single",
            expandEvent: "click",
            showCheckBoxesMode: "none", // none | normal | selectAll
            disabled: false,
            visible: true,

            dragEnabled: false,
            cascadeCheck: false,
            useIndeterminate: true,

            onItemClick: null,
            onSelectionChanged: null,
            onItemExpanded: null,
            onItemCollapsed: null,
            onOptionChanged: null,

            onDragStart: null,
            onDragEnter: null,
            onDragLeave: null,
            onDragOver: null,
            onDrop: null,
            onReorder: null,
            onMove: null
        },

        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-treeview")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .attr("role", "tree");

            if (cfg.onItemClick) this.on("itemClick", cfg.onItemClick);
            if (cfg.onSelectionChanged) this.on("selectionChanged", cfg.onSelectionChanged);
            if (cfg.onItemExpanded) this.on("itemExpanded", cfg.onItemExpanded);
            if (cfg.onItemCollapsed) this.on("itemCollapsed", cfg.onItemCollapsed);
            if (cfg.onOptionChanged) this.on("optionChanged", cfg.onOptionChanged);

            if (cfg.onDragStart) this.on("dragStart", cfg.onDragStart);
            if (cfg.onDragEnter) this.on("dragEnter", cfg.onDragEnter);
            if (cfg.onDragLeave) this.on("dragLeave", cfg.onDragLeave);
            if (cfg.onDragOver) this.on("dragOver", cfg.onDragOver);
            if (cfg.onDrop) this.on("drop", cfg.onDrop);
            if (cfg.onReorder) this.on("reorder", cfg.onReorder);
            if (cfg.onMove) this.on("move", cfg.onMove);

            this._selectedKeys = [];
            this._expandedKeys = [];

            this._indexItems();
            this._renderTree();

            if (cfg.dragEnabled) {
                this._enableDragDrop();
            }
        },

        _indexItems: function () {
            var cfg = this.config;
            var key = cfg.keyExpr;
            var parent = cfg.parentIdExpr;

            this._map = {};
            this._children = {};
            this._selectedKeys = [];
            this._expandedKeys = [];

            (cfg.items || []).forEach(function (item) {
                var id = item[key];
                var pid = item[parent];

                this._map[id] = item;
                this._children[pid] = this._children[pid] || [];
                this._children[pid].push(item);

                if (item.expanded) this._expandedKeys.push(id);
                if (item.selected) this._selectedKeys.push(id);

            }.bind(this));
        },

        _renderTree: function () {
            this.$container.empty();
            var roots = this._children[null] || this._children[undefined] || [];
            var $ul = $("<ul class='qpx-tree-root'></ul>");
            this._renderNodes($ul, roots);
            this.$container.append($ul);
        },

        _renderNodes: function ($parent, items) {
            var self = this;
            items.forEach(function (item) {
                var id = item[self.config.keyExpr];
                var text = item[self.config.displayExpr];
                var disabled = !!item.disabled;
                var expanded = self._expandedKeys.indexOf(id) !== -1;
                var selected = self._selectedKeys.indexOf(id) !== -1;

                var $li = $("<li class='qpx-tree-item' role='treeitem'></li>")
                    .attr("data-key", id)
                    .toggleClass("qpx-state-disabled", disabled)
                    .toggleClass("qpx-state-selected", selected)
                    .toggleClass("qpx-expanded", expanded);

                var $row = $("<div class='qpx-tree-row'></div>");
                if (self.config.dragEnabled && !disabled) {
                    $row.attr("draggable", "true");
                }

                var hasChildren = !!self._children[id];
                var $toggle = $("<span class='qpx-tree-toggle'></span>")
                    .text(hasChildren ? (expanded ? "▾" : "▸") : "")
                    .toggleClass("qpx-tree-toggle-empty", !hasChildren);

                var $checkbox = null;
                if (self.config.showCheckBoxesMode !== "none") {
                    $checkbox = $("<input type='checkbox' class='qpx-tree-checkbox' />")
                        .prop("checked", selected)
                        .prop("disabled", disabled);
                }

                var $icon = null;
                if (item.icon) {
                    $icon = $("<span class='qpx-tree-icon'></span>");
                    if (String(item.icon).indexOf("css:") === 0)
                        $icon.addClass(String(item.icon).slice(4));
                    else
                        $icon.text(item.icon);
                }

                var $text = $("<span class='qpx-tree-text'></span>").text(text);

                $row.append($toggle);
                if ($checkbox) $row.append($checkbox);
                if ($icon) $row.append($icon);
                $row.append($text);

                $li.append($row);

                $toggle.on(self.config.expandEvent + ".qpxTree", function () {
                    if (disabled || !hasChildren) return;
                    self._toggleExpand(id, $li);
                });

                $row.on("click.qpxTree", function () {
                    if (disabled) return;
                    var checked = !$li.hasClass("qpx-state-selected");
                    self._handleSelection(id, item, $li, checked);
                    if (self.config.cascadeCheck && self.config.showCheckBoxesMode !== "none") {
                        self._cascadeToChildren(id, checked);
                        if (self.config.useIndeterminate) {
                            self._updateParentIndeterminate(id);
                        }
                    }
                    self.trigger("itemClick", { itemData: item, key: id, component: self });
                });

                if ($checkbox) {
                    $checkbox.on("change.qpxTree", function () {
                        if (disabled) return;

                        var checked = $checkbox.prop("checked");

                        self._handleSelection(id, item, $li, checked);

                        if (self.config.cascadeCheck) {
                            self._cascadeToChildren(id, checked);
                        }

                        if (self.config.useIndeterminate) {
                            self._updateParentIndeterminate(id);
                        }
                    });
                }

                if (hasChildren) {
                    var $ul = $("<ul class='qpx-tree-children'></ul>")
                        .toggle(expanded);
                    self._renderNodes($ul, self._children[id]);
                    $li.append($ul);
                }

                $parent.append($li);
            });
        },

        _toggleExpand: function (id, $li) {
            var expanded = $li.hasClass("qpx-expanded");
            $li.toggleClass("qpx-expanded", !expanded);
            $li.children("ul.qpx-tree-children").slideToggle(120);

            if (!expanded) {
                if (this._expandedKeys.indexOf(id) === -1) this._expandedKeys.push(id);
                this.trigger("itemExpanded", { key: id, component: this });
            } else {
                this._expandedKeys = this._expandedKeys.filter(function (k) { return k !== id; });
                this.trigger("itemCollapsed", { key: id, component: this });
            }
        },

        _handleSelection: function (id, item, $li, checked) {
            var mode = this.config.selectionMode;
            var prev = this._selectedKeys.slice();

            if (mode === "single") {
                this._selectedKeys = checked ? [id] : [];
            } else {
                var idx = this._selectedKeys.indexOf(id);
                if (checked && idx === -1) this._selectedKeys.push(id);
                if (!checked && idx !== -1) this._selectedKeys.splice(idx, 1);
            }

            this.$container.find(".qpx-tree-item").removeClass("qpx-state-selected");
            this._selectedKeys.forEach(function (k) {
                this.$container.find("[data-key='" + k + "']").addClass("qpx-state-selected");
            }.bind(this));

            this.trigger("selectionChanged", {
                selectedItemKeys: this._selectedKeys.slice(),
                previousItemKeys: prev,
                component: this
            });
        },

        _cascadeToChildren: function (id, checked) {
            var self = this;
            var children = this._children[id];
            if (!children) return;

            children.forEach(function (child) {
                var childId = child[self.config.keyExpr];

                var idx = self._selectedKeys.indexOf(childId);
                if (checked && idx === -1) self._selectedKeys.push(childId);
                if (!checked && idx !== -1) self._selectedKeys.splice(idx, 1);

                var $childItem = self.$container.find("[data-key='" + childId + "']");
                var $checkbox = $childItem.find(".qpx-tree-checkbox");
                if ($checkbox.length) {
                    $checkbox.prop("checked", checked);
                    $checkbox.prop("indeterminate", false);
                }

                self._cascadeToChildren(childId, checked);
            });

            this.$container.find(".qpx-tree-item").removeClass("qpx-state-selected");
            this._selectedKeys.forEach(function (k) {
                this.$container.find("[data-key='" + k + "']").addClass("qpx-state-selected");
            }.bind(this));
        },

        _updateParentIndeterminate: function (id) {
            var parentId = this._map[id][this.config.parentIdExpr];
            if (parentId === null || parentId === undefined) return;

            var children = this._children[parentId];
            if (!children) return;

            var selectedCount = 0;
            var childCount = children.length;

            children.forEach(function (child) {
                var childId = child[this.config.keyExpr];
                if (this._selectedKeys.indexOf(childId) !== -1) {
                    selectedCount++;
                }
            }.bind(this));

            var $parentItem = this.$container.find("[data-key='" + parentId + "']");
            var $checkbox = $parentItem.find(".qpx-tree-checkbox");

            if (!$checkbox.length) return;

            if (selectedCount === 0) {
                $checkbox.prop("checked", false);
                $checkbox.prop("indeterminate", false);
            } else if (selectedCount === childCount) {
                $checkbox.prop("checked", true);
                $checkbox.prop("indeterminate", false);
            } else {
                $checkbox.prop("checked", false);
                $checkbox.prop("indeterminate", true);
            }

            this._updateParentIndeterminate(parentId);
        },

        _enableDragDrop: function () {
            var self = this;

            this.$container.on("dragstart.qpxTree", ".qpx-tree-row", function (e) {
                var $row = $(this);
                var $item = $row.closest(".qpx-tree-item");
                var key = $item.data("key");

                e.originalEvent.dataTransfer.effectAllowed = "move";
                e.originalEvent.dataTransfer.setData("text/plain", key);

                $item.addClass("qpx-tree-dragging");

                self.trigger("dragStart", { key, item: self._map[key], component: self });
            });

            this.$container.on("dragend.qpxTree", ".qpx-tree-row", function () {
                self.$container.find(".qpx-tree-dragging").removeClass("qpx-tree-dragging");
                self.$container.find(".qpx-tree-drop-target")
                    .removeClass("qpx-tree-drop-target qpx-tree-drop-above qpx-tree-drop-below qpx-tree-drop-inside");
            });

            this.$container.on("dragenter.qpxTree", ".qpx-tree-row", function (e) {
                e.preventDefault();
                var $row = $(this);
                var $item = $row.closest(".qpx-tree-item");
                $item.addClass("qpx-tree-drop-target");

                var key = $item.data("key");
                self.trigger("dragEnter", { key, item: self._map[key], component: self });
            });

            this.$container.on("dragleave.qpxTree", ".qpx-tree-row", function () {
                var $item = $(this).closest(".qpx-tree-item");
                $item.removeClass("qpx-tree-drop-target qpx-tree-drop-above qpx-tree-drop-below qpx-tree-drop-inside");

                var key = $item.data("key");
                self.trigger("dragLeave", { key, item: self._map[key], component: self });
            });

            this.$container.on("dragover.qpxTree", ".qpx-tree-row", function (e) {
                e.preventDefault();

                var $row = $(this);
                var $item = $row.closest(".qpx-tree-item");
                var offset = $row.offset();
                var y = e.originalEvent.clientY - offset.top;

                $item.removeClass("qpx-tree-drop-above qpx-tree-drop-below qpx-tree-drop-inside");

                if (y < 8) {
                    $item.addClass("qpx-tree-drop-above");
                } else if (y > $row.outerHeight() - 8) {
                    $item.addClass("qpx-tree-drop-below");
                } else {
                    $item.addClass("qpx-tree-drop-inside");
                }

                var key = $item.data("key");
                self.trigger("dragOver", { key, item: self._map[key], component: self });
            });

            this.$container.on("drop.qpxTree", ".qpx-tree-row", function (e) {
                e.preventDefault();

                var $targetRow = $(this);
                var $targetItem = $targetRow.closest(".qpx-tree-item");
                var targetKey = $targetItem.data("key");

                var sourceKey = e.originalEvent.dataTransfer.getData("text/plain");
                var sourceItem = self._map[sourceKey];
                var targetItem = self._map[targetKey];

                var dropType = $targetItem.hasClass("qpx-tree-drop-above") ? "above"
                    : $targetItem.hasClass("qpx-tree-drop-below") ? "below"
                    : "inside";

                self._performDrop(sourceKey, targetKey, dropType);

                self.trigger("drop", {
                    sourceKey,
                    targetKey,
                    dropType,
                    sourceItem,
                    targetItem,
                    component: self
                });
            });
        },

        _performDrop: function (sourceKey, targetKey, dropType) {
            var cfg = this.config;
            var keyExpr = cfg.keyExpr;
            var parentExpr = cfg.parentIdExpr;

            var source = this._map[sourceKey];
            var target = this._map[targetKey];

            if (!source || !target) return;

            var oldParent = source[parentExpr];

            if (dropType === "inside") {
                source[parentExpr] = target[keyExpr];

                this.trigger("move", {
                    sourceKey,
                    targetKey,
                    newParent: target[keyExpr],
                    oldParent,
                    component: this
                });
            } else {
                var siblings = this._children[target[parentExpr]] || [];
                var targetIndex = siblings.indexOf(target);

                var sourceSiblings = this._children[source[parentExpr]];
                if (sourceSiblings) {
                    var idx = sourceSiblings.indexOf(source);
                    if (idx !== -1) sourceSiblings.splice(idx, 1);
                }

                source[parentExpr] = target[parentExpr];

                siblings = this._children[target[parentExpr]] || [];
                if (dropType === "above") {
                    siblings.splice(targetIndex, 0, source);
                } else {
                    siblings.splice(targetIndex + 1, 0, source);
                }

                this.trigger("reorder", {
                    sourceKey,
                    targetKey,
                    dropType,
                    newParent: target[parentExpr],
                    oldParent,
                    component: this
                });
            }

            this._indexItems();
            this._renderTree();
            if (this.config.dragEnabled) this._enableDragDrop();
        },

        option: function (name, value) {
            if (arguments.length === 0) return this.config;
            if (qpx.isObject(name)) {
                var self = this;
                $.each(name, function (k, v) { self.option(k, v); });
                return this;
            }
            if (arguments.length === 1) return this.config[name];

            var prev = this.config[name];
            if (prev === value) return this;

            this.config[name] = value;

            if (name === "items") {
                this._indexItems();
                this._renderTree();
                if (this.config.dragEnabled) this._enableDragDrop();
            } else if (name === "visible") {
                this.$container.toggleClass("qpx-hidden", !value);
            } else if (name === "disabled") {
                this.$container.toggleClass("qpx-state-disabled", !!value);
            } else if (name === "dragEnabled") {
                this.$container.off(".qpxTree");
                this._renderTree();
                if (value) this._enableDragDrop();
            }

            this.trigger("optionChanged", { name, value, previousValue: prev });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxTree");
            this._super();
        }
    });

    qpx.registerWidget("qpTreeView", TreeView);
    qpx.qpTreeView = TreeView;

})(window.qpx, jQuery);
