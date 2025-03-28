import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

interface Position {
  symbol: string;
  assetName: string;
  quantity: number;
  averageEntryPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  currentPrice: number;
}

interface TradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position | null;
  action: "modify" | "exit" | null;
  onConfirm: (action: string, symbol: string, quantity: number, price: number | null, type: string) => void;
}

export function TradeDialog({ open, onOpenChange, position, action, onConfirm }: TradeDialogProps) {
  const [quantity, setQuantity] = useState(position ? Math.abs(position.quantity) : 0);
  const [price, setPrice] = useState<number | null>(position?.currentPrice || null);
  const [orderType, setOrderType] = useState("market");

  // Reset form when dialog opens with new position
  useEffect(() => {
    if (position) {
      setQuantity(Math.abs(position.quantity));
      setPrice(position.currentPrice);
    }
  }, [position]);

  const handleConfirm = () => {
    if (!position) return;
    
    onConfirm(
      action || "exit",
      position.symbol,
      quantity,
      orderType === "market" ? null : price,
      orderType
    );
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (!position) return null;

  // Determine if this is a long or short position
  const isLong = position.quantity > 0;
  const actionVerb = action === "exit" ? (isLong ? "Sell" : "Buy to Cover") : "Modify";
  const dialogTitle = `${actionVerb} ${position.symbol} Position`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="symbol" className="text-right">Symbol</Label>
            <div id="symbol" className="col-span-3 font-medium">{position.symbol}</div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current-position" className="text-right">Current Position</Label>
            <div id="current-position" className="col-span-3">
              {position.quantity} shares at {formatCurrency(position.averageEntryPrice)}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current-price" className="text-right">Current Price</Label>
            <div id="current-price" className="col-span-3">{formatCurrency(position.currentPrice)}</div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="order-type" className="text-right">Order Type</Label>
            <Select
              value={orderType}
              onValueChange={setOrderType}
            >
              <SelectTrigger id="order-type" className="col-span-3">
                <SelectValue placeholder="Select order type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">Quantity</Label>
            <Input
              id="quantity"
              className="col-span-3"
              type="number"
              min={1}
              max={Math.abs(position.quantity)}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
          {orderType === "limit" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">Limit Price</Label>
              <Input
                id="price"
                className="col-span-3"
                type="number"
                min={0.01}
                step={0.01}
                value={price || ""}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
          )}
          
          {action === "exit" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="estimate" className="text-right">Estimated Value</Label>
              <div id="estimate" className="col-span-3 font-medium">
                {formatCurrency(quantity * (price || position.currentPrice))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm}>
            {action === "exit" ? (isLong ? "Sell Position" : "Cover Position") : "Modify Position"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}