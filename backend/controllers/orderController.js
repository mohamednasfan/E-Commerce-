import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import { isValidObjectId } from "mongoose";

// Utility Function
function calcPrices(orderItems) {
  const itemsPrice = orderItems.reduce(
    (acc, item) => acc + item.price * item.qty,
    0
  );

  const shippingPrice = itemsPrice > 100 ? 0 : 10;
  const taxRate = 0.15;
  const taxPrice = (itemsPrice * taxRate).toFixed(2);

  const totalPrice = (
    itemsPrice +
    shippingPrice +
    parseFloat(taxPrice)
  ).toFixed(2);

  return {
    itemsPrice: itemsPrice.toFixed(2),
    shippingPrice: shippingPrice.toFixed(2),
    taxPrice,
    totalPrice,
  };
}

const createOrder = async (req, res) => {
  try {
    const body =
      req.body !== null && typeof req.body === "object" ? req.body : {};
    const { orderItems, shippingAddress, paymentMethod } = body;

    // NoSQL fix: orderItems must be a non-empty array of { _id: string, qty }.
    // Without this, {"_id":{"$ne":null}} flows into $in and .map crashes (DoS).
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ error: "No order items" });
    }
    const itemIds = [];
    for (const item of orderItems) {
      if (
        item === null ||
        typeof item !== "object" ||
        typeof item._id !== "string" ||
        !isValidObjectId(item._id)
      ) {
        return res.status(400).json({ error: "Invalid order item id" });
      }
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ error: "Invalid order item quantity" });
      }
      itemIds.push(item._id);
    }
    if (typeof paymentMethod !== "string" || paymentMethod.trim() === "") {
      return res.status(400).json({ error: "Payment method is required" });
    }

    const itemsFromDB = await Product.find({
      _id: { $in: itemIds },
    });

    const dbOrderItems = [];
    for (const itemFromClient of orderItems) {
      const matchingItemFromDB = itemsFromDB.find(
        (itemFromDB) => itemFromDB._id.toString() === itemFromClient._id
      );

      if (!matchingItemFromDB) {
        return res
          .status(404)
          .json({ error: `Product not found: ${itemFromClient._id}` });
      }

      // Whitelist only: never spread client object (prevents price override
      // attempts and operator keys like $set from reaching the DB layer).
      dbOrderItems.push({
        name:
          typeof itemFromClient.name === "string"
            ? itemFromClient.name.slice(0, 200)
            : matchingItemFromDB.name,
        qty: Number(itemFromClient.qty),
        image:
          typeof itemFromClient.image === "string"
            ? itemFromClient.image.slice(0, 500)
            : matchingItemFromDB.image,
        product: itemFromClient._id,
        price: matchingItemFromDB.price,
      });
    }

    const address =
      shippingAddress !== null && typeof shippingAddress === "object"
        ? shippingAddress
        : {};
    const strField = (v) => (typeof v === "string" ? v.slice(0, 200) : "");
    const cleanAddress = {
      address: strField(address.address),
      city: strField(address.city),
      postalCode: strField(address.postalCode),
      country: strField(address.country),
    };
    if (
      !cleanAddress.address ||
      !cleanAddress.city ||
      !cleanAddress.postalCode ||
      !cleanAddress.country
    ) {
      return res.status(400).json({ error: "Shipping address is required" });
    }

    const { itemsPrice, taxPrice, shippingPrice, totalPrice } =
      calcPrices(dbOrderItems);

    const order = new Order({
      orderItems: dbOrderItems,
      user: req.user._id,
      shippingAddress: cleanAddress,
      paymentMethod: paymentMethod.trim().slice(0, 50),
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate("user", "id username");
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const countTotalOrders = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    res.json({ totalOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const calculateTotalSales = async (req, res) => {
  try {
    const orders = await Order.find();
    const totalSales = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    res.json({ totalSales });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const calcualteTotalSalesByDate = async (req, res) => {
  try {
    const salesByDate = await Order.aggregate([
      {
        $match: {
          isPaid: true,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$paidAt" },
          },
          totalSales: { $sum: "$totalPrice" },
        },
      },
    ]);

    res.json(salesByDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const findOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "username email"
    );

    if (order) {
      res.json(order);
    } else {
      res.status(404);
      throw new Error("Order not found");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markOrderAsPaid = async (req, res) => {
  try {
    if (typeof req.params.id !== "string" || !isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid order id" });
    }
    const body =
      req.body !== null && typeof req.body === "object" ? req.body : {};
    const payer =
      body.payer !== null && typeof body.payer === "object" ? body.payer : {};
    const asString = (v, max = 200) =>
      typeof v === "string" ? v.slice(0, max) : undefined;
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: asString(body.id),
        status: asString(body.status),
        update_time: asString(body.update_time),
        email_address: asString(payer.email_address),
      };

      const updateOrder = await order.save();
      res.status(200).json(updateOrder);
    } else {
      res.status(404);
      throw new Error("Order not found");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markOrderAsDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error("Order not found");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export {
  createOrder,
  getAllOrders,
  getUserOrders,
  countTotalOrders,
  calculateTotalSales,
  calcualteTotalSalesByDate,
  findOrderById,
  markOrderAsPaid,
  markOrderAsDelivered,
};
